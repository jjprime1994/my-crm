import { describe, it, expect } from "vitest"
import { filterLeads, buildAdNameFilter, type AdminInfo } from "./lead-filter"

// Teams used across scenarios (mirrors production shape):
//   defaultTeam — covers KL + Selangor, is the default/catch-all team
//   penangTeam  — covers Penang only
//   openTeam    — no state restriction
const defaultTeam: AdminInfo = { id: "default", coveredStates: ["Kuala Lumpur", "Selangor"], isDefaultTeam: true }
const penangTeam: AdminInfo = { id: "penang", coveredStates: ["Penang"], isDefaultTeam: false }
const openTeam: AdminInfo = { id: "open", coveredStates: [], isDefaultTeam: false }

const managerStates = {
  default: ["Kuala Lumpur", "Selangor"],
  penang: ["Penang"],
  open: [],
}

const noRoutes = { routeIndex: {}, routedAdNames: new Set<string>() }

function visible(
  lead: { adName?: string | null; branch?: string | null },
  admin: AdminInfo,
  opts?: {
    routeIndex?: Record<string, string[]>
    routedAdNames?: Set<string>
    states?: Record<string, string[]>
    hasDefaultTeam?: boolean
  },
) {
  return (
    filterLeads(
      [lead],
      admin,
      opts?.routeIndex ?? noRoutes.routeIndex,
      opts?.routedAdNames ?? noRoutes.routedAdNames,
      opts?.states ?? managerStates,
      opts?.hasDefaultTeam ?? true,
    ).length === 1
  )
}

describe("filterLeads — no effective admin", () => {
  it("sees nothing", () => {
    expect(visible({ adName: "Ad", branch: "Penang" }, null)).toBe(false)
  })
})

describe("filterLeads — leads with no adName (website / no-source) route by state", () => {
  const lead = { adName: null, branch: "Penang" }

  it("team covering the state sees it", () => {
    expect(visible(lead, penangTeam)).toBe(true)
  })

  it("team covering other states does not (strict state routing)", () => {
    expect(visible(lead, defaultTeam)).toBe(false)
  })

  it("unrestricted team defers when another team covers the state", () => {
    expect(visible(lead, openTeam)).toBe(false)
  })

  it("unrestricted team sees it when no team covers the state", () => {
    expect(visible({ adName: null, branch: "Sabah" }, openTeam)).toBe(true)
  })

  it("no state at all → default team only", () => {
    const stateless = { adName: null, branch: null }
    expect(visible(stateless, defaultTeam)).toBe(true)
    expect(visible(stateless, penangTeam)).toBe(false)
  })

  it("no state and no default team exists → visible to all", () => {
    const stateless = { adName: null, branch: null }
    expect(visible(stateless, penangTeam, { hasDefaultTeam: false })).toBe(true)
  })
})

describe("filterLeads — unrouted adName falls to the default team", () => {
  const lead = { adName: "Unrouted Ad", branch: "Penang" }

  it("default team catches it, even outside its covered states", () => {
    expect(visible(lead, defaultTeam)).toBe(true)
  })

  it("non-default teams never see it", () => {
    expect(visible(lead, penangTeam)).toBe(false)
  })

  it("with no default team, everyone sees it", () => {
    expect(visible(lead, penangTeam, { hasDefaultTeam: false })).toBe(true)
  })

  it("routed ad with an empty team list behaves as unrouted", () => {
    const opts = { routeIndex: { "Empty Ad": [] as string[] }, routedAdNames: new Set(["Empty Ad"]) }
    expect(visible({ adName: "Empty Ad", branch: "Penang" }, defaultTeam, opts)).toBe(true)
    expect(visible({ adName: "Empty Ad", branch: "Penang" }, penangTeam, opts)).toBe(false)
  })
})

describe("filterLeads — routed ads", () => {
  const routed = {
    routeIndex: { "Penang Ad": ["penang"], "Shared Ad": ["penang", "open"] },
    routedAdNames: new Set(["Penang Ad", "Shared Ad"]),
  }

  it("assigned team sees leads in its covered states", () => {
    expect(visible({ adName: "Penang Ad", branch: "Penang" }, penangTeam, routed)).toBe(true)
  })

  it("assigned team does NOT see leads outside its covered states", () => {
    expect(visible({ adName: "Penang Ad", branch: "Selangor" }, penangTeam, routed)).toBe(false)
  })

  it("unassigned non-default team never sees routed leads", () => {
    expect(visible({ adName: "Penang Ad", branch: "Penang" }, openTeam, { ...routed, routeIndex: { "Penang Ad": ["penang"] } })).toBe(false)
  })

  it("default team stays out when the assigned team covers the lead's state", () => {
    expect(visible({ adName: "Penang Ad", branch: "Penang" }, defaultTeam, routed)).toBe(false)
  })

  it("default team catches overflow when assigned teams don't cover the lead's state", () => {
    expect(visible({ adName: "Penang Ad", branch: "Selangor" }, defaultTeam, routed)).toBe(true)
  })

  it("assigned unrestricted team defers to a co-assigned team that covers the state", () => {
    expect(visible({ adName: "Shared Ad", branch: "Penang" }, openTeam, routed)).toBe(false)
  })

  it("assigned unrestricted team takes states no co-assigned team covers", () => {
    expect(visible({ adName: "Shared Ad", branch: "Sabah" }, openTeam, routed)).toBe(true)
  })

  it("stateless lead on a routed ad goes to the unrestricted assigned team", () => {
    expect(visible({ adName: "Shared Ad", branch: null }, openTeam, routed)).toBe(true)
    expect(visible({ adName: "Shared Ad", branch: null }, penangTeam, routed)).toBe(false)
  })

  it("stateless lead stays visible when every assigned team is state-restricted", () => {
    const opts = { routeIndex: { "Penang Ad": ["penang"] }, routedAdNames: new Set(["Penang Ad"]) }
    expect(visible({ adName: "Penang Ad", branch: null }, penangTeam, opts)).toBe(true)
  })
})

describe("buildAdNameFilter — DB pre-filter", () => {
  const routes = [
    { adName: "Penang Ad", teamIds: ["penang"] },
    { adName: "Other Ad", teamIds: ["other"] },
  ]

  it("default team loads everything (no filter)", () => {
    expect(buildAdNameFilter(defaultTeam, routes, true)).toEqual({})
  })

  it("non-default team loads its own routes plus no-adName leads", () => {
    expect(buildAdNameFilter(penangTeam, routes, true)).toEqual({
      OR: [{ adName: null }, { adName: { in: ["Penang Ad"] } }],
    })
  })

  it("includes unrouted leads only when there is no default team", () => {
    expect(buildAdNameFilter(penangTeam, routes, false)).toEqual({
      OR: [
        { adName: null },
        { adName: { in: ["Penang Ad"] } },
        { adName: { notIn: ["Penang Ad", "Other Ad"] } },
      ],
    })
  })
})
