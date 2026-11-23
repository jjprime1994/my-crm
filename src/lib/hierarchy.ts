// Pure (no DB) - ordering people by team and reporting line for reports/exports.
import type { ScopedUser } from "@/lib/team-scope"

export type HierarchyGroup = { teamId: string | null; label: string; people: { user: ScopedUser; depth: number }[] }

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Manager", TEAM_LEADER: "Team Leader", SALESPERSON: "Salesperson" }
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? role

/**
 * Groups people into teams following the reporting tree, for reports like the commission export:
 *   1. Super Admins with no team ("Management") on top
 *   2. Each team, A→Z by label: team head, then each team leader followed by their own reports,
 *      then the head's direct salespeople (depth = levels below the head)
 *   3. "No team" last
 */
export function groupByHierarchy(users: ScopedUser[]): HierarchyGroup[] {
  const byName = (a: ScopedUser, b: ScopedUser) => a.name.localeCompare(b.name)
  const reportsOf = new Map<string, ScopedUser[]>()
  for (const u of users) if (u.managerId) reportsOf.set(u.managerId, [...(reportsOf.get(u.managerId) ?? []), u])

  const management = users.filter((u) => !u.teamId && u.role === "SUPER_ADMIN").sort(byName)
  const noTeam = users.filter((u) => !u.teamId && u.role !== "SUPER_ADMIN").sort(byName)
  const teamIds = [...new Set(users.map((u) => u.teamId).filter((t): t is string => !!t))]

  const teams: HierarchyGroup[] = teamIds.map((teamId) => {
    const members = users.filter((u) => u.teamId === teamId)
    const head = members.find((u) => u.id === teamId)
    const placed = new Set<string>()
    const people: HierarchyGroup["people"] = []
    const walk = (u: ScopedUser, depth: number) => {
      if (placed.has(u.id)) return
      placed.add(u.id)
      people.push({ user: u, depth })
      const kids = (reportsOf.get(u.id) ?? []).filter((k) => k.teamId === teamId)
      // Team leaders (with their people) first, then everyone else
      const leaders = kids.filter((k) => k.role === "TEAM_LEADER" || k.role === "ADMIN").sort(byName)
      const rest = kids.filter((k) => !leaders.includes(k)).sort(byName)
      for (const k of [...leaders, ...rest]) walk(k, depth + 1)
    }
    if (head) walk(head, 0)
    for (const u of members.sort(byName)) walk(u, 1) // safety net: anyone not reached from the head
    return { teamId, label: members[0]?.teamLabel ?? "Team", people }
  }).sort((a, b) => a.label.localeCompare(b.label))

  return [
    ...(management.length ? [{ teamId: null, label: "Management", people: management.map((user) => ({ user, depth: 0 })) }] : []),
    ...teams,
    ...(noTeam.length ? [{ teamId: null, label: "No team", people: noTeam.map((user) => ({ user, depth: 0 })) }] : []),
  ]
}
