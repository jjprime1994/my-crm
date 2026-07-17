import { db } from "@/lib/db"
import { filterLeads, buildAdNameFilter, buildIndividualGrants, type AdminInfo } from "@/lib/lead-filter"

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

export async function getAvailableLeads(userId: string, role: string) {
  // StateRoute members only see unassigned leads from their assigned state(s) —
  // plus any ad individually routed to them directly (e.g. a language-specific ad),
  // which overrides the state restriction.
  const stateRoutes = await db.stateRoute.findMany({
    where: { userIds: { has: userId } },
    select: { state: true },
  }).catch(() => [])

  if (stateRoutes.length > 0) {
    const states = stateRoutes.map((r) => r.state)
    const individualRoutes = await db.adRoute.findMany({
      where: { archived: false, userIds: { has: userId } },
      select: { adName: true, userStates: true },
    }).catch(() => [])
    const individualGrants = buildIndividualGrants(individualRoutes, userId)
    const individualConditions = Array.from(individualGrants.entries()).map(([adName, allowedStates]) =>
      allowedStates.length > 0 ? { adName, branch: { in: allowedStates } } : { adName }
    )

    return db.lead.findMany({
      where: {
        assignedToId: null,
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        OR: [
          { branch: { in: states } },
          ...individualConditions,
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, adName: true, campaignName: true, branch: true, source: true, isDuplicate: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
  }

  // Step 1: fetch routing config first — lightweight, needed to build the lead query
  const [allRoutes, allManagers, effectiveAdmin] = await Promise.all([
    db.adRoute.findMany({ where: { archived: false } }).catch(() => []),
    db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } }).catch(() => []),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])

  const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(allRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))
  const hasDefaultTeam = allManagers.some((m) => m.isDefaultTeam)
  const individualGrants = buildIndividualGrants(allRoutes.filter((r) => r.userIds.includes(userId)), userId)

  // Step 2: pre-filter leads in the DB — non-default teams skip other teams' ad routes entirely,
  // avoiding a full table scan of the unassigned pool on every page load.
  const adNameFilter = buildAdNameFilter(effectiveAdmin, allRoutes, hasDefaultTeam, individualGrants)

  // Step 3: fetch only leads that can possibly be visible to this admin
  const allLeads = await db.lead.findMany({
    where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, ...adNameFilter },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, adName: true, campaignName: true, branch: true, source: true, isDuplicate: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return filterLeads(allLeads, effectiveAdmin, routeIndex, routedAdNames, managerStates, hasDefaultTeam, individualGrants)
}

// Server-side guard for the claim endpoint: a lead is claimable iff it would
// appear in this user's available-leads pool. Mirrors getAvailableLeads exactly,
// for a single lead — keep the two in sync.
export async function isLeadClaimableBy(
  userId: string,
  role: string,
  lead: { adName: string | null; branch: string | null },
): Promise<boolean> {
  const stateRoutes = await db.stateRoute.findMany({
    where: { userIds: { has: userId } },
    select: { state: true },
  }).catch(() => [])

  if (stateRoutes.length > 0) {
    if (lead.branch !== null && stateRoutes.some((r) => r.state === lead.branch)) return true
    if (!lead.adName) return false
    const individualRoute = await db.adRoute.findFirst({
      where: { archived: false, adName: lead.adName, userIds: { has: userId } },
      select: { userStates: true },
    }).catch(() => null)
    if (!individualRoute) return false
    const allowedStates = (individualRoute.userStates as Record<string, string[]> | null)?.[userId] ?? []
    return allowedStates.length === 0 || (lead.branch !== null && allowedStates.includes(lead.branch))
  }

  const [allRoutes, allManagers, effectiveAdmin] = await Promise.all([
    db.adRoute.findMany({ where: { archived: false }, select: { adName: true, teamIds: true, userIds: true, userStates: true } }).catch(() => []),
    db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } }).catch(() => []),
    getEffectiveAdmin(userId, role).catch(() => null),
  ])
  const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
  const routedAdNames = new Set(allRoutes.map((r) => r.adName))
  const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))
  const hasDefaultTeam = allManagers.some((m) => m.isDefaultTeam)
  const individualGrants = buildIndividualGrants(allRoutes.filter((r) => r.userIds.includes(userId)), userId)
  return filterLeads([lead], effectiveAdmin, routeIndex, routedAdNames, managerStates, hasDefaultTeam, individualGrants).length === 1
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
      const individualRoutes = await db.adRoute.findMany({
        where: { archived: false, userIds: { has: userId } },
        select: { adName: true, userStates: true },
      }).catch(() => [])
      const individualGrants = buildIndividualGrants(individualRoutes, userId)
      const individualConditions = Array.from(individualGrants.entries()).map(([adName, allowedStates]) =>
        allowedStates.length > 0 ? { adName, branch: { in: allowedStates } } : { adName }
      )
      return db.lead.count({
        where: {
          assignedToId: null,
          status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          OR: [
            { branch: { in: states } },
            ...individualConditions,
          ],
        },
      }).catch(() => 0)
    }

    const [allRoutes, allManagers, effectiveAdmin] = await Promise.all([
      db.adRoute.findMany({ where: { archived: false }, select: { adName: true, teamIds: true, userIds: true, userStates: true } }).catch(() => []),
      db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, coveredStates: true, isDefaultTeam: true } }).catch(() => []),
      getEffectiveAdmin(userId, role).catch(() => null),
    ])
    const routeIndex = Object.fromEntries(allRoutes.map((r) => [r.adName, r.teamIds]))
    const routedAdNames = new Set(allRoutes.map((r) => r.adName))
    const managerStates = Object.fromEntries(allManagers.map((m) => [m.id, m.coveredStates]))
    const hasDefaultTeam = allManagers.some((m) => m.isDefaultTeam)
    const individualGrants = buildIndividualGrants(allRoutes.filter((r) => r.userIds.includes(userId)), userId)
    const adNameFilter = buildAdNameFilter(effectiveAdmin, allRoutes, hasDefaultTeam, individualGrants)
    const leanLeads = await db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] }, ...adNameFilter },
      select: { adName: true, branch: true },
    })
    return filterLeads(leanLeads, effectiveAdmin, routeIndex, routedAdNames, managerStates, hasDefaultTeam, individualGrants).length
  } catch {
    return 0
  }
}
