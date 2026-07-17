// Audits ASSIGNED leads (not the unclaimed pool) against the routing rules:
// for every active assigned lead, could the assignee legitimately hold it?
//
//  - assignee in a StateRoute        -> lead.branch must be one of their states
//  - otherwise                       -> lead must pass filterLeads for the
//                                       assignee's effective admin (team coverage)
//  - lead's state has a StateRoute   -> assignee should be in it (round-robin target)
//
// Read-only. Usage:  npx tsx scripts/check-assignments.ts [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const { getEffectiveAdmin } = await import("../src/lib/available-leads")
  const { filterLeads, buildIndividualGrants } = await import("../src/lib/lead-filter")

  const [leads, users, stateRoutes, adRoutes, managers] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: { not: null }, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      select: {
        id: true, firstName: true, lastName: true, branch: true, adName: true,
        source: true, status: true, isDuplicate: true, createdAt: true,
        assignedToId: true, claimedById: true, claimedAt: true,
        assignmentLogs: {
          orderBy: { createdAt: "desc" }, take: 1,
          select: { source: true, createdAt: true, assignedBy: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({ select: { id: true, name: true, role: true, managerId: true } }),
    db.stateRoute.findMany({ select: { state: true, userIds: true } }),
    db.adRoute.findMany({ where: { archived: false } }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, coveredStates: true, isDefaultTeam: true },
    }),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const routeIndex = Object.fromEntries(adRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(adRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(managers.map((m) => [m.id, m.coveredStates]))
  const hasDefaultTeam = managers.some((m) => m.isDefaultTeam)
  const managerName = new Map(managers.map((m) => [m.id, m.name]))
  const statesOf = (userId: string) =>
    stateRoutes.filter((r) => r.userIds.includes(userId)).map((r) => r.state)
  const routeForState = new Map(stateRoutes.map((r) => [r.state, r.userIds]))

  // effective admin per assignee, computed once
  const adminCache = new Map<string, Awaited<ReturnType<typeof getEffectiveAdmin>>>()
  for (const uid of new Set(leads.map((l) => l.assignedToId!))) {
    const u = userById.get(uid)
    adminCache.set(uid, u ? await getEffectiveAdmin(u.id, u.role) : null)
  }

  type Finding = { lead: (typeof leads)[number]; assignee: string; problem: string }
  const findings: Finding[] = []

  for (const lead of leads) {
    const assignee = userById.get(lead.assignedToId!)
    if (!assignee) {
      findings.push({ lead, assignee: lead.assignedToId!, problem: "assigned to a user that no longer exists" })
      continue
    }
    if (assignee.role === "SUPER_ADMIN") continue // super admin can hold anything

    const myStates = statesOf(assignee.id)
    const myGrants = buildIndividualGrants(adRoutes.filter((r) => r.userIds.includes(assignee.id)), assignee.id)
    const grantedStates = lead.adName ? myGrants.get(lead.adName) : undefined
    const individuallyRouted = grantedStates !== undefined &&
      (grantedStates.length === 0 || (lead.branch !== null && grantedStates.includes(lead.branch)))

    if (myStates.length > 0) {
      // Rule 1: StateRoute members hold ONLY their states' leads, unless the ad is
      // individually routed to them directly (e.g. a language-specific override).
      if (!individuallyRouted && (!lead.branch || !myStates.includes(lead.branch))) {
        findings.push({
          lead, assignee: assignee.name,
          problem: `${assignee.name} is a ${myStates.join("/")} state-route member but holds a "${lead.branch ?? "no state"}" lead`,
        })
      }
      continue
    }

    // Lead's state has a dedicated StateRoute but the assignee isn't in it
    if (lead.branch && routeForState.has(lead.branch)) {
      const admin = adminCache.get(assignee.id)
      const coversAnyway = admin?.coveredStates.includes(lead.branch)
      if (!coversAnyway) {
        findings.push({
          lead, assignee: assignee.name,
          problem: `"${lead.branch}" has its own state route, but the lead is held by ${assignee.name}` +
            (admin ? ` (team: ${managerName.get(admin.id) ?? admin.id}${admin.isDefaultTeam ? ", default" : ""})` : " (no team)"),
        })
      }
      continue
    }

    // Rule 2/3: would this lead have been visible to the assignee's team at all?
    const admin = adminCache.get(assignee.id) ?? null
    const visible = filterLeads([lead], admin, routeIndex, routedAdNames, managerStates, hasDefaultTeam, myGrants)
    if (visible.length === 0) {
      findings.push({
        lead, assignee: assignee.name,
        problem: `not visible to ${assignee.name}'s team` +
          (admin ? ` (${managerName.get(admin.id) ?? admin.id}: states ${admin.coveredStates.join(", ") || "none"}${admin.isDefaultTeam ? ", default" : ""})` : " (no effective admin)"),
      })
    }
  }

  console.log(`Checked ${leads.length} active assigned leads.\n`)
  if (findings.length === 0) {
    console.log("✅ Every active assigned lead is held by someone allowed to hold it.")
    process.exit(0)
  }

  console.log(`❌ ${findings.length} suspicious assignment(s):\n`)
  for (const { lead, problem } of findings) {
    const log = lead.assignmentLogs[0]
    const how = log
      ? `${log.source}${log.assignedBy ? ` by ${log.assignedBy.name}` : ""} @ ${log.createdAt.toISOString().slice(0, 16)}`
      : lead.claimedById
        ? `claimed ${lead.claimedAt?.toISOString().slice(0, 16) ?? ""}`
        : "auto-assigned by webhook (no log)"
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "(no name)"
    console.log(` - ${name} [${lead.source}${lead.isDuplicate ? ", dup" : ""}, ${lead.status}, created ${lead.createdAt.toISOString().slice(0, 10)}]`)
    console.log(`     ${problem}`)
    console.log(`     how: ${how}   lead id: ${lead.id}\n`)
  }
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
