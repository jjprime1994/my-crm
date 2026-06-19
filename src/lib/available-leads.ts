import { db } from "@/lib/db"

type AdminInfo = { id: string; coveredStates: string[]; isDefaultTeam: boolean } | null

export async function getEffectiveAdmin(userId: string, role: string): Promise<AdminInfo> {
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

type Lead = {
  adName?: string | null
  branch?: string | null
}

function filterLeads<T extends Lead>(
  allLeads: T[],
  effectiveAdmin: AdminInfo,
  routeIndex: Record<string, string[]>,
  routedAdNames: Set<string>,
  managerStates: Record<string, string[]>,
  hasDefaultTeam: boolean,
): T[] {
  return allLeads.filter((lead) => {
    if (!effectiveAdmin) return false

    const adName = lead.adName ?? null
    const branch = lead.branch ?? null
    const adIsRouted = adName ? routedAdNames.has(adName) : false

    const assignedTeams = adIsRouted && adName ? (routeIndex[adName] ?? []) : []
    const hasTeamsAssigned = assignedTeams.length > 0

    // Lead is effectively unrouted when: no AdRoute record exists, or the route has no teams
    // assigned yet. When a default team is configured it handles these as the catch-all;
    // otherwise fall through to all admins so leads are never invisible.
    if (!adIsRouted || !hasTeamsAssigned) {
      return hasDefaultTeam ? effectiveAdmin.isDefaultTeam : true
    }

    const teamIsAssigned = assignedTeams.includes(effectiveAdmin.id)

    if (!teamIsAssigned) {
      if (effectiveAdmin.isDefaultTeam) {
        const leadCoveredByAssignedTeam = assignedTeams.some((teamId) => {
          const states = managerStates[teamId] ?? []
          if (states.length === 0) return true
          return branch ? states.includes(branch) : true
        })
        return !leadCoveredByAssignedTeam
      }
      return false
    }

    // No state on lead: prefer teams with no state restriction.
    // If every assigned team has a state restriction, fall back to showing all so the lead isn't invisible.
    if (!branch) {
      if (effectiveAdmin.coveredStates.length === 0) return true
      const anyUnconfiguredTeam = assignedTeams.some((id) => (managerStates[id] ?? []).length === 0)
      return !anyUnconfiguredTeam
    }
    if (effectiveAdmin.coveredStates.length === 0) {
      // No state restriction configured. If another assigned team explicitly covers
      // this branch, defer to them so the same lead doesn't bleed across teams.
      const anotherTeamCoversThisBranch = assignedTeams
        .filter((id) => id !== effectiveAdmin.id)
        .some((teamId) => {
          const states = managerStates[teamId] ?? []
          return states.length > 0 && states.includes(branch)
        })
      return !anotherTeamCoversThisBranch
    }
    return effectiveAdmin.coveredStates.includes(branch)
  })
}

export async function getAvailableLeads(userId: string, role: string) {
  // StateRoute members only see unassigned leads from their assigned state(s)
  const stateRoutes = await db.stateRoute.findMany({
    where: { userIds: { has: userId } },
    select: { state: true },
  }).catch(() => [])

  if (stateRoutes.length > 0) {
    const states = stateRoutes.map((r) => r.state)
    return db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, branch: { in: states } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, adName: true, campaignName: true, branch: true, source: true, isDuplicate: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
  }

  const [allLeads, allRoutes, allManagers, effectiveAdmin] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, adName: true, campaignName: true, branch: true, source: true, isDuplicate: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.adRoute.findMany().catch(() => []),
    db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } }).catch(() => []),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])

  const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(allRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))
  const hasDefaultTeam = allManagers.some((m) => m.isDefaultTeam)

  return filterLeads(allLeads, effectiveAdmin, routeIndex, routedAdNames, managerStates, hasDefaultTeam)
}

export async function getAvailableLeadsCount(userId: string, role: string): Promise<number> {
  if (role === "SUPER_ADMIN") {
    return db.lead.count({ where: { assignedToId: null } }).catch(() => 0)
  }

  try {
    // StateRoute members only count leads from their assigned state(s)
    const stateRoutes = await db.stateRoute.findMany({
      where: { userIds: { has: userId } },
      select: { state: true },
    }).catch(() => [])

    if (stateRoutes.length > 0) {
      const states = stateRoutes.map((r) => r.state)
      return db.lead.count({
        where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, branch: { in: states } },
      }).catch(() => 0)
    }

    // Fetch only the two fields filterLeads needs — avoids transferring full lead rows just for a count
    const [leanLeads, allRoutes, allManagers, effectiveAdmin] = await Promise.all([
      db.lead.findMany({
        where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
        select: { adName: true, branch: true },
      }),
      db.adRoute.findMany({ select: { adName: true, teamIds: true } }).catch(() => []),
      db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } }).catch(() => []),
      getEffectiveAdmin(userId, role).catch(() => null),
    ])
    const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
    const routedAdNames = new Set(allRoutes.map((r) => r.adName))
    const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))
    const hasDefaultTeam = allManagers.some((m) => m.isDefaultTeam)
    return filterLeads(leanLeads, effectiveAdmin, routeIndex, routedAdNames, managerStates, hasDefaultTeam).length
  } catch {
    return 0
  }
}
