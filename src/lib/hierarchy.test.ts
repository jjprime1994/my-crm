import { describe, expect, it } from "vitest"
import { groupByHierarchy } from "./hierarchy"
import type { ScopedUser } from "./team-scope"

const u = (id: string, role: string, managerId: string | null, teamId: string | null, teamLabel: string | null = teamId): ScopedUser => ({
  id, name: id, role, managerId, disabled: false, teamId, teamLabel,
})

describe("groupByHierarchy", () => {
  const users = [
    u("Zed", "SALESPERSON", "Boss", "Boss"),
    u("Boss", "ADMIN", null, "Boss"),
    u("TL-B", "TEAM_LEADER", "Boss", "Boss"),
    u("TL-A", "TEAM_LEADER", "Boss", "Boss"),
    u("Bob", "SALESPERSON", "TL-A", "Boss"),
    u("Amy", "SALESPERSON", "TL-B", "Boss"),
    u("Johnny", "SUPER_ADMIN", null, "Johnny"),
    u("Amar", "TEAM_LEADER", "Johnny", "Johnny"),
    u("JJ", "SUPER_ADMIN", null, null),
    u("Loner", "SALESPERSON", null, null),
  ]

  it("puts management first, teams A→Z, no team last", () => {
    expect(groupByHierarchy(users).map((g) => g.label)).toEqual(["Management", "Boss", "Johnny", "No team"])
  })

  it("orders a team as head → each team leader + their people → other direct reports", () => {
    const team = groupByHierarchy(users).find((g) => g.label === "Boss")!
    expect(team.people.map((p) => `${p.user.id}:${p.depth}`)).toEqual(["Boss:0", "TL-A:1", "Bob:2", "TL-B:1", "Amy:2", "Zed:1"])
  })

  it("treats a managing super admin as their team's head", () => {
    const team = groupByHierarchy(users).find((g) => g.label === "Johnny")!
    expect(team.people.map((p) => p.user.id)).toEqual(["Johnny", "Amar"])
  })
})
