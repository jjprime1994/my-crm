import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import AvailableLeadsClient from "@/components/AvailableLeadsClient"

type AdminInfo = { id: string; coveredStates: string[]; isDefaultTeam: boolean } | null

async function getEffectiveAdmin(userId: string, role: string): Promise<AdminInfo> {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return db.user.findUnique({
      where: { id: userId },
      select: { id: true, coveredStates: true, isDefaultTeam: true },
    })
  }
  const me = await db.user.findUnique({
    where: { id: userId },
    select: {
      manager: {
        select: {
          id: true, role: true, coveredStates: true, isDefaultTeam: true,
          manager: { select: { id: true, role: true, coveredStates: true, isDefaultTeam: true } },
        },
      },
    },
  })
  const mgr = me?.manager
  if (!mgr) return null
  if (mgr.role === "ADMIN" || mgr.role === "SUPER_ADMIN") return { id: mgr.id, coveredStates: mgr.coveredStates, isDefaultTeam: mgr.isDefaultTeam }
  if (mgr.manager && (mgr.manager.role === "ADMIN" || mgr.manager.role === "SUPER_ADMIN"))
    return { id: mgr.manager.id, coveredStates: mgr.manager.coveredStates, isDefaultTeam: mgr.manager.isDefaultTeam }
  return null
}

export default async function AvailableLeadsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const nextMidnightUTC = new Date(startOfDayInMYT + 24 * 60 * 60 * 1000 - MYT_OFFSET)

  const [allLeads, user, recentClaims, newLeadsCount] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, isDuplicate: false },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { claimLimit: true, newLeadThreshold: true },
    }),
    db.lead.count({
      where: { assignedToId: session.user.id, claimedAt: { gte: startOfDayUTC } },
    }),
    db.lead.count({
      where: { assignedToId: session.user.id, status: "NEW" },
    }),
  ])

  // These queries depend on new columns — fall back gracefully if migration hasn't run yet
  const [allRoutes, allManagers, effectiveAdmin] = await Promise.all([
    db.adRoute.findMany().catch(() => []),
    db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true } }).catch(() => []),
    getEffectiveAdmin(session.user.id, session.user.role).catch(() => null),
  ])

  // Build routing index: adName → teamIds
  const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(allRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))

  function isLeadCoveredByAnyAssignedTeam(adName: string | null, branch: string | null): boolean {
    if (!adName) return false
    const assignedTeams = routeIndex[adName] ?? []
    return assignedTeams.some((teamId) => {
      const states = managerStates[teamId] ?? []
      if (states.length === 0) return true // Team has no state restriction → covers all
      return branch ? states.includes(branch) : true
    })
  }

  // Filter leads based on routing rules
  const leads = allLeads.filter((lead) => {
    if (!effectiveAdmin) return false

    const adName = lead.adName ?? null
    const branch = lead.branch ?? null
    const adIsRouted = adName ? routedAdNames.has(adName) : false

    if (!adIsRouted) {
      // No routing rule for this ad → default team only
      return effectiveAdmin.isDefaultTeam
    }

    const assignedTeams = adName ? (routeIndex[adName] ?? []) : []
    const teamIsAssigned = assignedTeams.includes(effectiveAdmin.id)

    if (!teamIsAssigned) {
      // Team not assigned to this ad
      // Default team picks up leads that no assigned team covers
      if (effectiveAdmin.isDefaultTeam) {
        return !isLeadCoveredByAnyAssignedTeam(adName, branch)
      }
      return false
    }

    // Team is assigned — apply branch filter
    if (!branch) return true // No branch on lead (regional ad), team handles it
    if (effectiveAdmin.coveredStates.length === 0) return true // No state restriction set
    return effectiveAdmin.coveredStates.includes(branch)
  })

  const resetAt = nextMidnightUTC.toISOString()
  const threshold = user?.newLeadThreshold ?? 0
  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  return (
    <AvailableLeadsClient
      leads={leads}
      claimLimit={user?.claimLimit ?? 5}
      recentClaims={recentClaims}
      resetAt={resetAt}
      newLeadsCount={newLeadsCount}
      newLeadThreshold={threshold}
      isUnlimited={isSuperAdmin}
    />
  )
}
