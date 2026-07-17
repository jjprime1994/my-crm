// Pure lead-routing logic — no DB imports so it can be unit-tested directly.
// The behavior here must conform to CLAUDE.md → "Lead Routing Rules".

export type AdminInfo = { id: string; coveredStates: string[]; isDefaultTeam: boolean } | null

// Maps adName -> allowed states for an individually-granted user. An empty array means
// unrestricted (all states) — e.g. a dedicated language specialist covering the whole
// country. A non-empty array scopes the grant to only those states — e.g. a
// language-specific salesperson who should only see that ad's leads from their own state.
export type IndividualGrants = Map<string, string[]>

type Lead = {
  adName?: string | null
  branch?: string | null
}

// Builds an IndividualGrants map for one user from a set of AdRoute rows already
// filtered to routes where that user is in `userIds`. `userStates` is a Prisma Json
// column: { [userId]: string[] } — an empty/missing array means unrestricted.
export function buildIndividualGrants(
  routes: { adName: string; userStates: unknown }[],
  userId: string,
): IndividualGrants {
  const grants: IndividualGrants = new Map()
  for (const route of routes) {
    const states = (route.userStates as Record<string, string[]> | null)?.[userId] ?? []
    grants.set(route.adName, states)
  }
  return grants
}

export function filterLeads<T extends Lead>(
  allLeads: T[],
  effectiveAdmin: AdminInfo,
  routeIndex: Record<string, string[]>,
  routedAdNames: Set<string>,
  managerStates: Record<string, string[]>,
  hasDefaultTeam: boolean,
  individualGrants: IndividualGrants = new Map(),
): T[] {
  return allLeads.filter((lead) => {
    const adName = lead.adName ?? null
    const branch = lead.branch ?? null

    // Individual override: this specific person is granted the ad's leads directly
    // (e.g. a language-specific salesperson), regardless of their team's state coverage.
    // If the grant is state-scoped, it only applies to leads from those state(s).
    if (adName && individualGrants.has(adName)) {
      const allowedStates = individualGrants.get(adName)!
      if (allowedStates.length === 0 || (branch && allowedStates.includes(branch))) return true
    }

    if (!effectiveAdmin) return false

    const adIsRouted = adName ? routedAdNames.has(adName) : false

    const assignedTeams = adIsRouted && adName ? (routeIndex[adName] ?? []) : []
    const hasTeamsAssigned = assignedTeams.length > 0

    // Leads with no adName at all (source unknown) route by state coverage so they reach
    // the right team without being locked to the default team.
    if (!adName) {
      if (!branch) return hasDefaultTeam ? effectiveAdmin.isDefaultTeam : true
      if (effectiveAdmin.coveredStates.length === 0) {
        const anyTeamCoversThisState = Object.entries(managerStates).some(
          ([id, states]) => id !== effectiveAdmin.id && states.length > 0 && states.includes(branch)
        )
        return !anyTeamCoversThisState
      }
      return effectiveAdmin.coveredStates.includes(branch)
    }

    // Lead has an adName but no AdRoute configured (or route has no teams yet).
    // Default team handles these as catch-all; otherwise visible to all.
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

// Build a Prisma WHERE fragment that excludes leads from other teams' ad routes.
// Non-default teams don't need to load the entire unassigned pool — they only need:
//   1. Leads from their own ad routes
//   2. Leads with no adName (routed by state, filtered further in JS)
//   3. Unrouted leads (no route exists) when there's no default team to catch them
// Default teams load everything because they handle overflow from all other routes.
export function buildAdNameFilter(
  effectiveAdmin: AdminInfo,
  allRoutes: { adName: string; teamIds: string[] }[],
  hasDefaultTeam: boolean,
  individualGrants: IndividualGrants = new Map(),
): { OR?: object[] } {
  if (!effectiveAdmin || effectiveAdmin.isDefaultTeam) return {}

  const myAdNames = new Set([
    ...allRoutes.filter((r) => r.teamIds.includes(effectiveAdmin.id)).map((r) => r.adName),
    ...individualGrants.keys(),
  ])
  const allRoutedAdNames = allRoutes.map((r) => r.adName)

  const or: object[] = [
    { adName: null }, // no-source leads, state-filtered later in JS
    ...(myAdNames.size > 0 ? [{ adName: { in: Array.from(myAdNames) } }] : []),
    // Unrouted leads: only include when there's no default team (otherwise default team handles them)
    ...(!hasDefaultTeam && allRoutedAdNames.length > 0 ? [{ adName: { notIn: allRoutedAdNames } }] : []),
  ]

  return { OR: or }
}
