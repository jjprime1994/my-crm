import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isManagerLevel } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"
import ManagerTeamBreakdownClient from "@/components/ManagerTeamBreakdownClient"
import { businessMsElapsed } from "@/lib/responseTime"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Appointment Made", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
}
const STATUS_BAR: Record<LeadStatus, string> = {
  NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-rose-400",
}
const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-rose-500",
}

// Qualified was removed from the active pipeline (New -> Contacted -> Appointment Made ->
// Won/Lost) — the maps above stay complete for type safety, this is what actually renders.
const PIPELINE_STAGES: LeadStatus[] = ["NEW", "CONTACTED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"]

function statusCountsOf(leads: { status: LeadStatus }[]): Record<LeadStatus, number> {
  const counts: Record<LeadStatus, number> = {
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, PROPOSAL: 0, CLOSED_WON: 0, CLOSED_LOST: 0,
  }
  for (const l of leads) counts[l.status]++
  return counts
}

// Counts a lead under every stage it ever reached (per LeadStatusHistory), not just its
// current one — mirrors superadmin/overview's everReachedCountsOf. `from` is what recovers
// a lead's starting stage, since a row only ever logs the stage it moved TO.
function everReachedCountsOf(leads: { status: LeadStatus; statusHistory: { from: LeadStatus | null; to: LeadStatus }[] }[]): Record<LeadStatus, number> {
  const counts: Record<LeadStatus, number> = {
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, PROPOSAL: 0, CLOSED_WON: 0, CLOSED_LOST: 0,
  }
  for (const l of leads) {
    const reached = new Set(l.statusHistory.flatMap((h) => (h.from ? [h.from, h.to] : [h.to])))
    reached.add(l.status)
    for (const s of reached) counts[s]++
  }
  return counts
}

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All time", days: 0 },
]

export default async function ManagerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>
}) {
  const session = await auth()
  const [role, viewAsUser] = await Promise.all([
    getViewAsRole(session?.user.role),
    getViewAsUser(session?.user.role),
  ])
  const effectiveUserId = viewAsUser?.id ?? session!.user.id
  if (!isManagerLevel(role)) redirect("/")
  if (role === "SUPER_ADMIN") redirect("/superadmin/overview")

  const { period, tab: tabParam } = await searchParams
  const tab = tabParam ?? "overview"
  const days = Number(period ?? 30)
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  const dateFilter = since ? { createdAt: { gte: since } } : {}
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const isFullManager = isAdmin(role)

  // ADMIN sees all salespeople in their extended team (including under team leaders)
  // TEAM_LEADER sees only their direct salesperson reports
  const salespersonWhere = isFullManager
    ? {
        role: "SALESPERSON" as const,
        OR: [
          { managerId: effectiveUserId },
          { manager: { managerId: effectiveUserId } },
        ],
      }
    : { role: "SALESPERSON" as const, managerId: effectiveUserId }

  const leadsAssignedWhere = isFullManager
    ? {
        OR: [
          { assignedTo: { managerId: effectiveUserId } },
          { assignedTo: { manager: { managerId: effectiveUserId } } },
        ],
      }
    : { assignedTo: { managerId: effectiveUserId } }


  const [teamMembers, byStatus, overdueCount, leaderStats] = await Promise.all([
    db.user.findMany({
      where: salespersonWhere,
      select: {
        id: true,
        name: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        leads: {
          where: dateFilter,
          select: { status: true, updatedAt: true, claimedAt: true, firstContactedAt: true, statusHistory: { select: { from: true, to: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.lead.groupBy({
      by: ["status"],
      _count: true,
      where: { AND: [dateFilter, leadsAssignedWhere] },
    }),
    db.lead.count({
      where: {
        AND: [
          leadsAssignedWhere,
          {
            status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
            OR: [
              { followUpAt: { lte: new Date() } },
              { followUpAt: null, updatedAt: { lt: twoDaysAgo } },
            ],
          },
        ],
      },
    }),
    // Admin's own leads + team leaders' own leads in this period
    isFullManager
      ? db.user.findMany({
          where: {
            OR: [
              { id: effectiveUserId },
              { role: "TEAM_LEADER" as const, managerId: effectiveUserId },
            ],
          },
          select: {
            id: true, name: true, role: true, managerId: true,
            leads: { where: dateFilter, select: { status: true, claimedAt: true, updatedAt: true, firstContactedAt: true, statusHistory: { select: { from: true, to: true } } } },
          },
        })
      : Promise.resolve([] as { id: string; name: string; role: string; managerId: string | null; leads: { status: LeadStatus; claimedAt: Date | null; updatedAt: Date; firstContactedAt: Date | null; statusHistory: { from: LeadStatus | null; to: LeadStatus }[] }[] }[]),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0)
  const won = statusMap["CLOSED_WON"] ?? 0
  const lost = statusMap["CLOSED_LOST"] ?? 0
  const active = total - won - lost
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0

  function responseMetrics(leads: { claimedAt: Date | null; firstContactedAt: Date | null; status: string }[]) {
    const responseTimes = leads
      .filter((l) => l.claimedAt && l.firstContactedAt)
      .map((l) => businessMsElapsed(l.claimedAt!, l.firstContactedAt!))
    const avgResponseMs = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null
    const notContacted = leads.filter((l) =>
      l.claimedAt && !l.firstContactedAt && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST"
    ).length
    return { avgResponseMs, notContacted }
  }

  const members = teamMembers.map((m) => {
    const totalLeads = m.leads.length
    const wonCount = m.leads.filter((l) => l.status === "CLOSED_WON").length
    const claimedCount = m.leads.filter((l) => l.claimedAt).length
    const assignedCount = totalLeads - claimedCount
    const staleCount = m.leads.filter((l) =>
      l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST" &&
      (Date.now() - new Date(l.updatedAt).getTime()) > 2 * 86400000
    ).length
    return {
      id: m.id,
      name: m.name,
      managerId: m.managerId,
      managerName: m.manager?.name ?? null,
      totalLeads,
      claimed: claimedCount,
      assigned: assignedCount,
      won: wonCount,
      stale: staleCount,
      rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
      statusCounts: statusCountsOf(m.leads),
      everReachedCounts: everReachedCountsOf(m.leads),
      ...responseMetrics(m.leads),
    }
  }).sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  // Map of management users' own lead stats
  const leaderRowMap = new Map(leaderStats.map((u) => {
    const wonCount = u.leads.filter((l) => l.status === "CLOSED_WON").length
    const totalLeads = u.leads.length
    const claimedCount = u.leads.filter((l) => l.claimedAt).length
    const staleCount = u.leads.filter((l) =>
      l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST" &&
      (Date.now() - new Date(l.updatedAt).getTime()) > 2 * 86400000
    ).length
    return [u.id, {
      id: u.id, name: u.name, role: u.role,
      totalLeads, claimed: claimedCount, assigned: totalLeads - claimedCount,
      won: wonCount, stale: staleCount,
      rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
      statusCounts: statusCountsOf(u.leads),
      everReachedCounts: everReachedCountsOf(u.leads),
      ...responseMetrics(u.leads),
    }]
  }))
  const adminRow = leaderRowMap.get(effectiveUserId) ?? null

  // Group: direct reports to current user vs reports under a team leader
  const directMembers = members.filter((m) => m.managerId === effectiveUserId)
  const subTeamMap = new Map<string, { leaderName: string; members: typeof members }>()
  for (const m of members) {
    if (m.managerId !== effectiveUserId && m.managerId) {
      if (!subTeamMap.has(m.managerId)) {
        subTeamMap.set(m.managerId, { leaderName: m.managerName ?? "Unknown", members: [] })
      }
      subTeamMap.get(m.managerId)!.members.push(m)
    }
  }
  const subTeams = Array.from(subTeamMap.entries()).map(([leaderId, st]) => ({
    leaderId,
    leaderName: st.leaderName,
    leaderRow: leaderRowMap.get(leaderId) ?? null,
    members: st.members,
  }))

  const teamSections = [
    ...((adminRow && adminRow.totalLeads > 0) || directMembers.length > 0
      ? [{
          id: "__direct__",
          label: subTeams.length > 0 ? "Direct Reports" : "",
          headerRow: adminRow?.totalLeads ? adminRow : null,
          members: directMembers,
        }]
      : []),
    ...subTeams.map((st) => ({
      id: st.leaderId,
      label: `${st.leaderName}'s Team`,
      headerRow: st.leaderRow && st.leaderRow.totalLeads > 0 ? st.leaderRow : null,
      members: st.members,
    })),
  ]

  // Same sections, but with statusCounts swapped for "ever reached" counts, so the Funnel
  // tab can reuse the exact same table/chart without a parallel data model.
  const funnelSections = teamSections.map((s) => ({
    ...s,
    headerRow: s.headerRow ? { ...s.headerRow, statusCounts: s.headerRow.everReachedCounts } : null,
    members: s.members.map((m) => ({ ...m, statusCounts: m.everReachedCounts })),
  }))

  const periodLabel = days === 0 ? "All time" : `Last ${days} days`

  function buildUrl({ newPeriod, newTab }: { newPeriod?: number; newTab?: string } = {}) {
    const p = newPeriod !== undefined ? newPeriod : days
    const t = newTab !== undefined ? newTab : tab
    const params: string[] = []
    if (p === 0) params.push("period=0")
    else if (p !== 30) params.push(`period=${p}`)
    if (t !== "overview") params.push(`tab=${t}`)
    return params.length ? `?${params.join("&")}` : "?"
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "teams", label: "Teams" },
    { id: "funnel", label: "Funnel" },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">{role === "TEAM_LEADER" ? "Team Leader" : "Manager"}</p>
          <h1 className="text-2xl font-bold text-gray-900">Team Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
          {PERIODS.map(({ label, days: d }) => {
            const isActive = (days === d) || (d === 30 && !period)
            return (
              <Link
                key={label}
                href={buildUrl({ newPeriod: d })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex gap-1">
          {TABS.map(({ id, label }) => (
            <Link
              key={id}
              href={buildUrl({ newTab: id })}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                tab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team Leads", value: total, color: "text-gray-900", bg: "bg-gray-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: "Active Pipeline", value: active, color: "text-blue-600", bg: "bg-blue-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
          { label: "Won", value: won, color: "text-emerald-600", bg: "bg-emerald-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: "Needs Attention", value: overdueCount, color: overdueCount > 0 ? "text-rose-600" : "text-gray-900", bg: overdueCount > 0 ? "bg-rose-50" : "bg-gray-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={overdueCount > 0 ? "#e11d48" : "#6b7280"} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
            <div className={`p-2.5 ${bg} rounded-xl shrink-0`}>{icon}</div>
          </div>
        ))}
      </div>

      {/* Pipeline + Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Pipeline Funnel</h2>
          {total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No leads in this period.</p>
          ) : (
            <div className="space-y-3">
              {PIPELINE_STAGES.map((status) => {
                const count = statusMap[status] ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                        <span className="text-gray-600">{STATUS_LABELS[status]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs">{pct}%</span>
                        <span className="font-semibold text-gray-900 w-6 text-right">{count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${STATUS_BAR[status]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Conversion stat */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
          <h2 className="font-semibold text-gray-900 mb-5">Conversion</h2>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-bold text-violet-600">{conversionRate}%</span>
            <span className="text-sm text-gray-400 mb-2">overall</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${conversionRate}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{won} won</span>
            <span>{lost} lost</span>
            <span>{active} active</span>
          </div>
        </div>
      </div>

      </div>}

      {/* ── Teams tab ── */}
      {tab === "teams" && (
        members.length === 0 && !adminRow ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Team Breakdown</h2>
            </div>
            <div className="text-center py-12 text-sm text-gray-400">No team members yet.</div>
          </div>
        ) : (
          <ManagerTeamBreakdownClient sections={teamSections} />
        )
      )}

      {/* ── Funnel tab ── */}
      {tab === "funnel" && (
        members.length === 0 && !adminRow ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Funnel Breakdown</h2>
            </div>
            <div className="text-center py-12 text-sm text-gray-400">No team members yet.</div>
          </div>
        ) : (
          <ManagerTeamBreakdownClient
            sections={funnelSections}
            title="Funnel Breakdown"
            description="Counts a lead under every stage it ever reached — even one later marked Lost. For a snapshot of where leads currently sit, see the Teams tab."
            showFunnelChart
            showStageColumns
          />
        )
      )}

    </div>
  )
}
