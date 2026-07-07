import { db } from "@/lib/db"
import { getAvailableLeads, getAvailableLeadsCount, getEffectiveAdmin } from "@/lib/available-leads"
import { filterLeads, type AdminInfo } from "@/lib/lead-filter"

// Assignments made before this are grandfathered — the owner reviewed the
// pre-existing violations on 2026-07-07 and chose to leave them in place.
// (Midnight 8 Jul 2026 MYT, stored as UTC.)
const ASSIGNMENT_AUDIT_SINCE = new Date("2026-07-07T16:00:00Z")

// Runs the CLAUDE.md "Lead Routing Rules" invariants against the live database
// using the real production code paths. Returns human-readable violations
// (empty array = all invariants hold). Mirrors scripts/check-routing.ts.
export async function checkRoutingInvariants(): Promise<string[]> {
  const violations: string[] = []

  const [users, stateRoutes] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, role: true, claimLimit: true } }),
    db.stateRoute.findMany({ select: { state: true, userIds: true } }),
  ])

  const checkable = users.filter((u) => u.role !== "SUPER_ADMIN")

  // Small batches: enough parallelism to finish fast, without hammering the DB pool.
  const BATCH = 8
  for (let i = 0; i < checkable.length; i += BATCH) {
    await Promise.all(
      checkable.slice(i, i + BATCH).map(async (user) => {
        const [list, count] = await Promise.all([
          getAvailableLeads(user.id, user.role),
          getAvailableLeadsCount(user.id, user.role),
        ])

        // Invariant: counter must equal the claimable list
        if (count !== list.length) {
          violations.push(`${user.name}: counter shows ${count} but the claimable list has ${list.length}`)
        }

        // Invariant: StateRoute members see only their states' leads
        const myStates = new Set(stateRoutes.filter((r) => r.userIds.includes(user.id)).map((r) => r.state))
        if (myStates.size > 0) {
          for (const lead of list) {
            if (!lead.branch || !myStates.has(lead.branch)) {
              violations.push(
                `${user.name} (states: ${[...myStates].join(", ")}) can see lead ${lead.id} from "${lead.branch ?? "no state"}"`
              )
            }
          }
        }
      })
    )
  }

  // Invariant: nobody exceeds their daily claim limit — same window as the
  // claim endpoint (resets at midnight MYT)
  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowInMYT = Date.now() + MYT_OFFSET
  const startOfDayUTC = new Date(nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000)) - MYT_OFFSET)
  const recentClaims = await db.lead.groupBy({
    by: ["claimedById"],
    where: { claimedAt: { gte: startOfDayUTC }, claimedById: { not: null } },
    _count: { _all: true },
  })
  for (const row of recentClaims) {
    const u = users.find((x) => x.id === row.claimedById)
    if (u && row._count._all > u.claimLimit) {
      violations.push(`${u.name} claimed ${row._count._all} leads today (limit ${u.claimLimit})`)
    }
  }

  // Invariant: recently assigned leads are held by someone allowed to hold them
  violations.push(...(await checkAssignedLeads(users, stateRoutes)))

  return violations
}

// Audits leads assigned/claimed since ASSIGNMENT_AUDIT_SINCE: the holder must be
// allowed to hold the lead — state-route members only their states' leads, everyone
// else only leads their team's pool would show (same filterLeads as the pool).
// Mirrors scripts/check-assignments.ts.
async function checkAssignedLeads(
  users: { id: string; name: string; role: string }[],
  stateRoutes: { state: string; userIds: string[] }[],
): Promise<string[]> {
  const violations: string[] = []

  const [adRoutes, managers, leads] = await Promise.all([
    db.adRoute.findMany({ where: { archived: false }, select: { adName: true, teamIds: true } }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, coveredStates: true, isDefaultTeam: true },
    }),
    db.lead.findMany({
      where: {
        assignedToId: { not: null },
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        OR: [
          { claimedAt: { gte: ASSIGNMENT_AUDIT_SINCE } },
          { createdAt: { gte: ASSIGNMENT_AUDIT_SINCE } },
          { assignmentLogs: { some: { createdAt: { gte: ASSIGNMENT_AUDIT_SINCE } } } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, adName: true, branch: true, assignedToId: true },
    }),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const routeIndex = Object.fromEntries(adRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(adRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(managers.map((m) => [m.id, m.coveredStates]))
  const hasDefaultTeam = managers.some((m) => m.isDefaultTeam)

  const adminCache = new Map<string, AdminInfo>()
  for (const lead of leads) {
    const assignee = userById.get(lead.assignedToId!)
    if (!assignee || assignee.role === "SUPER_ADMIN") continue

    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.id
    const myStates = stateRoutes.filter((r) => r.userIds.includes(assignee.id)).map((r) => r.state)

    if (myStates.length > 0) {
      if (!lead.branch || !myStates.includes(lead.branch)) {
        violations.push(
          `${assignee.name} (${myStates.join("/")} state route) holds "${lead.branch ?? "no state"}" lead ${leadName}`
        )
      }
      continue
    }

    if (!adminCache.has(assignee.id)) {
      adminCache.set(assignee.id, await getEffectiveAdmin(assignee.id, assignee.role).catch(() => null))
    }
    const admin = adminCache.get(assignee.id) ?? null
    const visible = filterLeads([lead], admin, routeIndex, routedAdNames, managerStates, hasDefaultTeam)
    if (visible.length === 0) {
      violations.push(
        `${assignee.name} holds lead ${leadName} their team's pool would not show (ad "${lead.adName ?? "none"}", state ${lead.branch ?? "none"})`
      )
    }
  }

  return violations
}
