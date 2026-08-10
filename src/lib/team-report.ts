import { db } from "@/lib/db"

export type TeamReportRow = {
  id: string
  name: string
  role: "SALESPERSON" | "TEAM_LEADER" | "ADMIN" | "SUPER_ADMIN"
  teamId: string
  team: string
  claimed: number
  won: number
  totalLeads: number
  rate: number
  avgResponseMs: number | null
  notContacted: number
}

type LeadForMetrics = { status: string; claimedAt: Date | null; firstContactedAt: Date | null }

function computeMetrics(leads: LeadForMetrics[]) {
  const won = leads.filter((l) => l.status === "CLOSED_WON").length
  const totalLeads = leads.length
  const claimed = leads.filter((l) => l.claimedAt).length
  const responseTimes = leads
    .filter((l) => l.claimedAt && l.firstContactedAt)
    .map((l) => new Date(l.firstContactedAt!).getTime() - new Date(l.claimedAt!).getTime())
    .filter((ms) => ms >= 0)
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null
  const notContacted = leads.filter((l) =>
    l.claimedAt && !l.firstContactedAt && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST"
  ).length
  return { won, totalLeads, claimed, avgResponseMs, notContacted, rate: totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0 }
}

// Flat, per-member rows carrying a "team" label (the top-level manager's name),
// sorted by team then by performance — suitable for a grouped-by-team report/export.
export async function getTeamReport(since: Date | null, until: Date | null = null): Promise<TeamReportRow[]> {
  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (since) createdAtFilter.gte = since
  if (until) createdAtFilter.lte = until
  const dateFilter = Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}

  const [salespersonStats, mgmtStats] = await Promise.all([
    db.user.findMany({
      where: { role: "SALESPERSON" },
      select: {
        id: true, name: true,
        manager: {
          select: {
            id: true, name: true, role: true,
            manager: { select: { id: true, name: true } },
          },
        },
        leads: { where: dateFilter, select: { status: true, claimedAt: true, firstContactedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"] } },
      select: {
        id: true, name: true, role: true, managerId: true,
        leads: { where: dateFilter, select: { status: true, claimedAt: true, firstContactedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const mgmtNameById = new Map(mgmtStats.map((u) => [u.id, u.name]))

  const salespersonRows: TeamReportRow[] = salespersonStats.map((s) => {
    // Team leaders' salespeople belong to the leader's own manager's team;
    // matches the grouping used on the Business Overview Teams tab.
    const isUnderLeader = s.manager?.role === "TEAM_LEADER"
    const teamId = isUnderLeader ? (s.manager?.manager?.id ?? "__none__") : (s.manager?.id ?? "__none__")
    const team = isUnderLeader ? (s.manager?.manager?.name ?? "No Manager") : (s.manager?.name ?? "No Manager")
    return { id: s.id, name: s.name, role: "SALESPERSON", teamId, team, ...computeMetrics(s.leads) }
  })

  const mgmtRows: TeamReportRow[] = mgmtStats
    .map((u) => {
      const metrics = computeMetrics(u.leads)
      if (metrics.totalLeads === 0) return null
      const teamId = u.managerId ?? u.id
      const team = u.managerId ? (mgmtNameById.get(u.managerId) ?? u.name) : u.name
      return { id: u.id, name: u.name, role: u.role, teamId, team, ...metrics }
    })
    .filter((r): r is TeamReportRow => r !== null)

  return [...salespersonRows, ...mgmtRows].sort((a, b) =>
    a.team.localeCompare(b.team) || b.won - a.won || b.totalLeads - a.totalLeads
  )
}
