// Pure (no DB) - ordering people by team and reporting line. Used by the commission
// Excel export and the MA/LA pages so both show the same order.

/** The fields the ordering needs (ScopedUser from team-scope satisfies this). */
export type HierarchyUser = {
  id: string
  name: string
  role: string
  managerId: string | null
  teamId: string | null
  teamLabel: string | null
}

export const MANAGEMENT_KEY = "__management"
export const NO_TEAM_KEY = "__none"

export type HierarchyGroup<T extends HierarchyUser = HierarchyUser> = {
  /** teamId, or MANAGEMENT_KEY / NO_TEAM_KEY */
  key: string
  teamId: string | null
  label: string
  people: { user: T; depth: number }[]
}

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Manager", TEAM_LEADER: "Team Leader", SALESPERSON: "Salesperson" }
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? role

/** Which group a person falls in: their team, Management (teamless Super Admin), or No team. */
export const groupKeyOf = (u: Pick<HierarchyUser, "teamId" | "role">) =>
  u.teamId ?? (u.role === "SUPER_ADMIN" ? MANAGEMENT_KEY : NO_TEAM_KEY)

/**
 * Groups people into teams following the reporting tree:
 *   1. Super Admins with no team ("Management") on top
 *   2. Each team, A→Z by label: team head, then each team leader followed by their own reports,
 *      then the head's direct salespeople (depth = levels below the head)
 *   3. "No team" last
 * Works on partial lists too (e.g. a team leader's own scope): anyone whose manager isn't in the
 * list starts the tree for their team.
 */
export function groupByHierarchy<T extends HierarchyUser>(users: T[]): HierarchyGroup<T>[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  const leadersFirst = (list: T[]) => {
    const leaders = list.filter((k) => k.role === "TEAM_LEADER" || k.role === "ADMIN" || k.role === "SUPER_ADMIN").sort(byName)
    return [...leaders, ...list.filter((k) => !leaders.includes(k)).sort(byName)]
  }
  const reportsOf = new Map<string, T[]>()
  for (const u of users) if (u.managerId) reportsOf.set(u.managerId, [...(reportsOf.get(u.managerId) ?? []), u])

  const management = users.filter((u) => groupKeyOf(u) === MANAGEMENT_KEY).sort(byName)
  const noTeam = users.filter((u) => groupKeyOf(u) === NO_TEAM_KEY).sort(byName)
  const teamIds = [...new Set(users.map((u) => u.teamId).filter((t): t is string => !!t))]

  const teams: HierarchyGroup<T>[] = teamIds.map((teamId) => {
    const members = users.filter((u) => u.teamId === teamId)
    const ids = new Set(members.map((u) => u.id))
    const placed = new Set<string>()
    const people: HierarchyGroup<T>["people"] = []
    const walk = (u: T, depth: number) => {
      if (placed.has(u.id)) return
      placed.add(u.id)
      people.push({ user: u, depth })
      // Team leaders (with their people) first, then everyone else
      for (const k of leadersFirst((reportsOf.get(u.id) ?? []).filter((k) => k.teamId === teamId))) walk(k, depth + 1)
    }
    const head = members.find((u) => u.id === teamId)
    if (head) walk(head, 0)
    // Anyone not reached from the head (head not in this list, or a broken chain) starts its own branch
    const roots = members.filter((u) => !placed.has(u.id) && (!u.managerId || !ids.has(u.managerId)))
    for (const u of leadersFirst(roots)) walk(u, head ? 1 : 0)
    for (const u of members.sort(byName)) walk(u, 1) // last-resort safety net (cycles)
    return { key: teamId, teamId, label: members[0]?.teamLabel ?? "Team", people }
  }).sort((a, b) => a.label.localeCompare(b.label))

  return [
    ...(management.length ? [{ key: MANAGEMENT_KEY, teamId: null, label: "Management", people: management.map((user) => ({ user, depth: 0 })) }] : []),
    ...teams,
    ...(noTeam.length ? [{ key: NO_TEAM_KEY, teamId: null, label: "No team", people: noTeam.map((user) => ({ user, depth: 0 })) }] : []),
  ]
}

/** Flattened position of each person (for sorting) plus their depth and group. */
export function hierarchyIndex<T extends HierarchyUser>(groups: HierarchyGroup<T>[]) {
  const index = new Map<string, { rank: number; depth: number; groupKey: string; groupLabel: string }>()
  let rank = 0
  for (const g of groups) for (const p of g.people) index.set(p.user.id, { rank: rank++, depth: p.depth, groupKey: g.key, groupLabel: g.label })
  return index
}
