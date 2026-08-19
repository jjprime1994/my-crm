import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import { businessMsElapsed } from "@/lib/responseTime"

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
  statusCounts: Record<LeadStatus, number>
}

type LeadForMetrics = { status: LeadStatus; createdAt: Date; claimedAt: Date | null; firstContactedAt: Date | null }

function inRange(date: Date, since: Date | null, until: Date | null): boolean {
  if (since && date < since) return false
  if (until && date > until) return false
  return true
}

// `leads` may include leads created outside [since, until], as long as they were claimed
// inside the window (see the OR filter in getTeamReport) — funnel stats (totalLeads/won/
// statusCounts) stay scoped to leads *created* in the period, while claim-activity stats
// (claimed/avgResponseMs/notContacted) are scoped to leads *claimed* in the period. Without
// this split, a lead created before the window but claimed today silently drops out of
// "claimed" counts.
function computeMetrics(leads: LeadForMetrics[], since: Date | null, until: Date | null) {
  const createdInPeriod = leads.filter((l) => inRange(l.createdAt, since, until))
  const claimedInPeriod = leads.filter((l) => l.claimedAt && inRange(l.claimedAt, since, until))

  const statusCounts: Record<LeadStatus, number> = {
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, PROPOSAL: 0, CLOSED_WON: 0, CLOSED_LOST: 0,
  }
  for (const l of createdInPeriod) statusCounts[l.status]++
  const won = statusCounts.CLOSED_WON
  const totalLeads = createdInPeriod.length
  const claimed = claimedInPeriod.length
  const responseTimes = claimedInPeriod
    .filter((l) => l.firstContactedAt)
    .map((l) => businessMsElapsed(l.claimedAt!, l.firstContactedAt!))
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null
  const notContacted = claimedInPeriod.filter((l) =>
    !l.firstContactedAt && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST"
  ).length
  return { won, totalLeads, claimed, avgResponseMs, notContacted, statusCounts, rate: totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0 }
}

// Flat, per-member rows carrying a "team" label (the top-level manager's name),
// sorted by team then by performance — suitable for a grouped-by-team report/export.
export async function getTeamReport(since: Date | null, until: Date | null = null): Promise<TeamReportRow[]> {
  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (since) createdAtFilter.gte = since
  if (until) createdAtFilter.lte = until
  const hasWindow = Object.keys(createdAtFilter).length > 0
  const dateFilter = hasWindow ? { createdAt: createdAtFilter } : {}
  // Pull leads created in the window OR claimed in the window, so a lead created earlier
  // but claimed today still counts toward this period's claim-activity stats.
  const leadsWhere = hasWindow ? { OR: [dateFilter, { claimedAt: createdAtFilter }] } : {}

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
        leads: { where: leadsWhere, select: { status: true, createdAt: true, claimedAt: true, firstContactedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"] } },
      select: {
        id: true, name: true, role: true, managerId: true,
        leads: { where: leadsWhere, select: { status: true, createdAt: true, claimedAt: true, firstContactedAt: true } },
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
    return { id: s.id, name: s.name, role: "SALESPERSON", teamId, team, ...computeMetrics(s.leads, since, until) }
  })

  const mgmtRows: TeamReportRow[] = mgmtStats
    .map((u) => {
      const metrics = computeMetrics(u.leads, since, until)
      if (metrics.totalLeads === 0 && metrics.claimed === 0) return null
      const teamId = u.managerId ?? u.id
      const team = u.managerId ? (mgmtNameById.get(u.managerId) ?? u.name) : u.name
      return { id: u.id, name: u.name, role: u.role, teamId, team, ...metrics }
    })
    .filter((r): r is TeamReportRow => r !== null)

  return [...salespersonRows, ...mgmtRows].sort((a, b) =>
    a.team.localeCompare(b.team) || b.won - a.won || b.totalLeads - a.totalLeads
  )
}
