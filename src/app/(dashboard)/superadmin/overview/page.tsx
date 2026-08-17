import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import LeaderboardTabs from "@/components/LeaderboardTabs"
import TeamBreakdownClient from "@/components/TeamBreakdownClient"
import AnimatedBar from "@/components/AnimatedBar"
import { getViewAsRole } from "@/lib/viewas"
import StateViolationsButton from "@/components/StateViolationsButton"
import RepairBlankLeadsButton from "@/components/RepairBlankLeadsButton"
import MetaTokenRefreshTool from "@/components/MetaTokenRefreshTool"
import RoutingAuditTool from "@/components/RoutingAuditTool"
import { getCampaignPerformance } from "@/lib/campaign-stats"
import { initials } from "@/lib/format"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Proposal", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
}
const STATUS_BAR: Record<LeadStatus, string> = {
  NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-rose-400",
}
const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-rose-500",
}

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All time", days: 0 },
]

export default async function SuperAdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string; dateFrom?: string; dateTo?: string }>
}) {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const { period, tab: tabParam, dateFrom, dateTo } = await searchParams
  const tab = tabParam ?? "overview"
  const isCustomRange = Boolean(dateFrom || dateTo)
  const days = Number(period ?? 30)

  // MYT (UTC+8) day boundaries, matching the timezone convention used elsewhere in the app
  const since = isCustomRange
    ? (dateFrom ? new Date(`${dateFrom}T00:00:00+08:00`) : null)
    : (days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null)
  const until = isCustomRange && dateTo ? new Date(`${dateTo}T23:59:59+08:00`) : null

  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (since) createdAtFilter.gte = since
  if (until) createdAtFilter.lte = until
  const dateFilter = Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}

  const [total, byStatus, byPlatform, salespersonStats, managerStats, sourceStats, recentLeads, campaignPerformance, mgmtStats] = await Promise.all([
    db.lead.count({ where: dateFilter }),
    db.lead.groupBy({ by: ["status"], _count: true, where: dateFilter }),
    db.lead.groupBy({ by: ["source"], _count: true, where: dateFilter }),
    db.user.findMany({
      where: { role: "SALESPERSON" },
      select: {
        id: true, name: true, managerId: true,
        manager: {
          select: {
            id: true, name: true, role: true, managerId: true,
            manager: { select: { id: true, name: true } },
          },
        },
        _count: { select: { leads: true } },
        leads: { where: dateFilter, select: { status: true, claimedAt: true, firstContactedAt: true, updatedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
    // All top-level managers (ADMIN + SUPER_ADMIN with no parent manager)
    db.user.findMany({
      where: { managerId: null, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: {
        id: true, name: true,
        leads: { where: dateFilter, select: { status: true } },
        teamMembers: {
          select: {
            id: true,
            role: true,
            leads: { where: dateFilter, select: { status: true } },
            teamMembers: {
              select: {
                id: true,
                leads: { where: dateFilter, select: { status: true } },
              },
            },
          },
        },
      },
    }),
    db.lead.groupBy({
      by: ["campaignName"],
      _count: true,
      where: dateFilter,
      orderBy: { _count: { campaignName: "desc" } },
    }),
    db.lead.findMany({
      where: dateFilter,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { assignedTo: { select: { name: true } } },
    }),
    getCampaignPerformance(since, until),
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"] } },
      select: {
        id: true, name: true, role: true, managerId: true,
        leads: { where: dateFilter, select: { status: true, claimedAt: true, firstContactedAt: true, updatedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const won = statusMap["CLOSED_WON"] ?? 0
  const lost = statusMap["CLOSED_LOST"] ?? 0
  const active = total - won - lost
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0

  const platformMap = Object.fromEntries(byPlatform.map((s) => [s.source, s._count]))
  const PLATFORMS = [
    { key: "META", label: "Meta", color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
    { key: "WEBSITE", label: "Website", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
    { key: "TIKTOK", label: "TikTok", color: "text-pink-600", bg: "bg-pink-50", dot: "bg-pink-500" },
  ] as const
  const platformStats = PLATFORMS.map((p) => ({ ...p, count: platformMap[p.key] ?? 0 }))

  // Only show leads with a known campaign name
  const sourceRows = sourceStats
    .filter((s) => s.campaignName)
    .map((s) => ({ name: s.campaignName!, count: s._count }))
  const sourcedCount = sourceRows.reduce((sum, s) => sum + s.count, 0)

  const { campaigns } = campaignPerformance

  const individuals = salespersonStats
    .map((s) => {
      const wonCount = s.leads.filter((l) => l.status === "CLOSED_WON").length
      const totalLeads = s.leads.length
      const claimedCount = s.leads.filter((l) => l.claimedAt).length
      const staleCount = s.leads.filter((l) =>
        l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST" &&
        (Date.now() - new Date(l.updatedAt).getTime()) > 2 * 86400000
      ).length
      const responseTimes = s.leads
        .filter((l) => l.claimedAt && l.firstContactedAt)
        .map((l) => new Date(l.firstContactedAt!).getTime() - new Date(l.claimedAt!).getTime())
        .filter((ms) => ms >= 0)
      const avgResponseMs = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null
      const notContacted = s.leads.filter((l) =>
        l.claimedAt && !l.firstContactedAt && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST"
      ).length
      return {
        id: s.id, name: s.name, notContacted,
        managerId: s.managerId, managerName: s.manager?.name ?? null,
        managerRole: s.manager?.role ?? null,
        topManagerId: s.manager?.managerId ?? null,
        topManagerName: s.manager?.manager?.name ?? null,
        totalLeads, won: wonCount, claimed: claimedCount, assigned: totalLeads - claimedCount,
        stale: staleCount, rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0, avgResponseMs,
      }
    })
    .sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  // Management users' own leads (super admin, admins, team leaders)
  const mgmtRows = new Map(mgmtStats.map((u) => {
    const wonCount = u.leads.filter((l) => l.status === "CLOSED_WON").length
    const totalLeads = u.leads.length
    const claimedCount = u.leads.filter((l) => l.claimedAt).length
    const staleCount = u.leads.filter((l) =>
      l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST" &&
      (Date.now() - new Date(l.updatedAt).getTime()) > 2 * 86400000
    ).length
    const responseTimes = u.leads
      .filter((l) => l.claimedAt && l.firstContactedAt)
      .map((l) => new Date(l.firstContactedAt!).getTime() - new Date(l.claimedAt!).getTime())
      .filter((ms) => ms >= 0)
    const avgResponseMs = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null
    const notContacted = u.leads.filter((l) =>
      l.claimedAt && !l.firstContactedAt && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST"
    ).length
    return [u.id, {
      id: u.id, name: u.name, role: u.role, notContacted,
      totalLeads, claimed: claimedCount, assigned: totalLeads - claimedCount,
      won: wonCount, stale: staleCount, avgResponseMs,
      rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
    }]
  }))

  // Build hierarchical team breakdown: top-level manager → direct reports + sub-teams by team leader
  const topTeamMap = new Map<string, {
    managerName: string
    directMembers: (typeof individuals)[number][]
    subTeams: Map<string, { leaderName: string; members: (typeof individuals)[number][] }>
  }>()
  for (const m of individuals) {
    const isUnderLeader = m.managerRole === "TEAM_LEADER"
    const topId = isUnderLeader ? (m.topManagerId ?? "__none__") : (m.managerId ?? "__none__")
    const topName = isUnderLeader ? (m.topManagerName ?? "No Manager") : (m.managerName ?? "No Manager")
    if (!topTeamMap.has(topId)) topTeamMap.set(topId, { managerName: topName, directMembers: [], subTeams: new Map() })
    const topGroup = topTeamMap.get(topId)!
    if (isUnderLeader && m.managerId) {
      if (!topGroup.subTeams.has(m.managerId)) topGroup.subTeams.set(m.managerId, { leaderName: m.managerName ?? "Unknown", members: [] })
      topGroup.subTeams.get(m.managerId)!.members.push(m)
    } else {
      topGroup.directMembers.push(m)
    }
  }
  const teamBreakdownGroups = Array.from(topTeamMap.entries())
    .map(([id, g]) => ({
      managerId: id,
      managerName: g.managerName,
      managerRow: mgmtRows.get(id) ?? null,
      directMembers: [...g.directMembers].sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads),
      subTeams: Array.from(g.subTeams.entries())
        .map(([leaderId, st]) => ({
          leaderId,
          leaderName: st.leaderName,
          leaderRow: mgmtRows.get(leaderId) ?? null,
          members: [...st.members].sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads),
        }))
        .sort((a, b) => a.leaderName.localeCompare(b.leaderName)),
    }))
    .sort((a, b) => a.managerName.localeCompare(b.managerName))

  const teams = managerStats
    .map((m) => {
      // All direct reports (team leaders + salespeople) + their sub-reports + manager themselves
      const memberCount = 1 + m.teamMembers.length +
        m.teamMembers.reduce((sum, tm) => sum + tm.teamMembers.length, 0)
      // Leads from everyone under this manager's umbrella, including the manager's own leads
      const allLeads = [
        ...m.leads,
        ...m.teamMembers.flatMap((tm) => tm.leads),
        ...m.teamMembers.flatMap((tm) => tm.teamMembers.flatMap((sub) => sub.leads)),
      ]
      const totalLeads = allLeads.length
      const wonCount = allLeads.filter((l) => l.status === "CLOSED_WON").length
      return {
        managerId: m.id,
        managerName: m.name,
        memberCount,
        totalLeads,
        won: wonCount,
        rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
      }
    })
    .filter((t) => t.memberCount > 0)
    .sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  const fmtShort = (d: Date) => d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" })
  const periodLabel = isCustomRange
    ? `${since ? fmtShort(since) : "Start"} – ${until ? fmtShort(until) : "Now"}`
    : (days === 0 ? "All time" : `Last ${days} days`)

  function buildUrl({ newPeriod, newTab }: { newPeriod?: number; newTab?: string } = {}) {
    const p = newPeriod !== undefined ? newPeriod : days
    const t = newTab !== undefined ? newTab : tab
    const params: string[] = []
    if (p === 0) params.push("period=0")
    else if (p !== 30) params.push(`period=${p}`)
    if (t !== "overview") params.push(`tab=${t}`)
    return params.length ? `?${params.join("&")}` : "?"
  }

  // Query string carrying whichever range is active (custom dates or a preset period),
  // expressed as explicit dateFrom/dateTo so the export links match what's shown on screen.
  function rangeQueryParams(): string {
    const toMYTDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" })
    const from = isCustomRange ? dateFrom : (since ? toMYTDateStr(since) : undefined)
    const to = isCustomRange ? dateTo : undefined // presets have no explicit end date — means "up to now"
    const parts: string[] = []
    if (from) parts.push(`dateFrom=${from}`)
    if (to) parts.push(`dateTo=${to}`)
    return parts.length ? `?${parts.join("&")}` : ""
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "campaigns", label: "Campaigns" },
    { id: "teams", label: "Teams" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "tools", label: "Tools" },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Business Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            {PERIODS.map(({ label, days: d }) => {
              const active = !isCustomRange && ((days === d) || (d === 30 && !period))
              return (
                <Link
                  key={label}
                  href={buildUrl({ newPeriod: d })}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Custom date range */}
          <form className="flex items-center gap-1.5 bg-gray-100 rounded-xl px-2 py-1">
            <input type="hidden" name="tab" value={tab} />
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom ?? ""}
              className="text-xs bg-transparent focus:outline-none text-gray-700 w-[112px]"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo ?? ""}
              className="text-xs bg-transparent focus:outline-none text-gray-700 w-[112px]"
            />
            <button
              type="submit"
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition shrink-0"
            >
              Go
            </button>
          </form>
          {isCustomRange && (
            <Link href={buildUrl()} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear
            </Link>
          )}

          <Link
            href={`/superadmin/export${rangeQueryParams()}`}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-violet-200"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Leads
          </Link>
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
                  ? "border-violet-600 text-violet-600"
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

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: total, color: "text-gray-900", bg: "bg-gray-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: "Active Pipeline", value: active, color: "text-blue-600", bg: "bg-blue-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
          { label: "Won", value: won, color: "text-emerald-600", bg: "bg-emerald-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: "Conversion Rate", value: `${conversionRate}%`, color: "text-violet-600", bg: "bg-violet-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
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

      {/* Leads by platform */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {platformStats.map(({ key, label, count, color, bg, dot }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <p className="text-sm text-gray-500 font-medium">{label}</p>
              </div>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{count}</p>
            </div>
            <div className={`p-2.5 ${bg} rounded-xl shrink-0 text-xs font-semibold ${color}`}>
              {total > 0 ? Math.round((count / total) * 100) : 0}%
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Pipeline Funnel</h2>
          <div className="space-y-3">
            {Object.values(LeadStatus).map((status) => {
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
                    <AnimatedBar pct={pct} className={STATUS_BAR[status]} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Lead sources */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Lead Sources</h2>
            <span className="text-xs text-gray-400">{sourcedCount} of {total} tracked</span>
          </div>
          {sourceRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No source data yet.</p>
          ) : (
            <div className="space-y-3">
              {sourceRows.map((s, i) => {
                const pct = sourcedCount > 0 ? Math.round((s.count / sourcedCount) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600 truncate max-w-[200px]">{s.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs">{pct}%</span>
                        <span className="font-semibold text-gray-900 w-6 text-right">{s.count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top performers */}
      {(() => {
        const allIndividuals = [
          ...individuals.map((m) => ({ id: m.id, name: m.name, won: m.won, totalLeads: m.totalLeads, rate: m.rate })),
          ...Array.from(mgmtRows.values())
            .filter((m) => m.totalLeads > 0)
            .map((m) => ({ id: m.id, name: m.name, won: m.won, totalLeads: m.totalLeads, rate: m.rate })),
        ].sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads).slice(0, 8)
        const maxWon = allIndividuals[0]?.won ?? 0
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Top Performers — Won</h2>
            {allIndividuals.length === 0 || maxWon === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No won leads in this period.</p>
            ) : (
              <div className="space-y-3">
                {allIndividuals.map((m, i) => {
                  const barPct = maxWon > 0 ? Math.round((m.won / maxWon) * 100) : 0
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm shrink-0">{medal ?? <span className="text-xs text-gray-400">{i + 1}</span>}</span>
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-violet-600">{initials(m.name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-sm font-bold text-emerald-600">{m.won} won</span>
                            <span className="text-xs text-gray-400">({m.rate}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <AnimatedBar pct={barPct} className="bg-emerald-500" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Recent leads */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Recent Leads</h2>
          <Link href="/leads" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/40">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentLeads.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-sm text-gray-400">No leads in this period.</td></tr>
            )}
            {recentLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50/70 transition">
                <td className="px-6 py-3.5">
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-blue-600">{(lead.firstName?.[0] ?? "?").toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition text-sm">
                      {lead.firstName} {lead.lastName}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-3.5 text-sm text-gray-600">{lead.email ?? lead.phone ?? "—"}</td>
                <td className="px-6 py-3.5 text-sm text-gray-500 max-w-[150px] truncate">{lead.campaignName ?? lead.adName ?? "—"}</td>
                <td className="px-6 py-3.5 text-sm text-gray-600">{lead.assignedTo?.name ?? <span className="text-gray-300 text-xs">Unassigned</span>}</td>
                <td className="px-6 py-3.5 text-xs text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString("en-MY", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>}

      {/* ── Campaigns tab ── */}
      {tab === "campaigns" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div>
              <h2 className="font-semibold text-gray-900">Campaign Performance</h2>
              <p className="text-xs text-gray-400 mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {campaigns.length > 0 && (
                <a
                  href={`/api/export/campaigns${rangeQueryParams()}`}
                  className="inline-flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </a>
              )}
            </div>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No campaign data in this period.</div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Unclaimed</th>
                  {Object.values(LeadStatus).map((status) => (
                    <th key={status} className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {STATUS_LABELS[status]}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Conv.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                    <tr key={c.name} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4 max-w-[180px]">
                        <span className="font-medium text-gray-800 text-sm truncate block">{c.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">{c.total}</span>
                      </td>
                      <td className="px-6 py-4">
                        {c.unclaimed > 0 ? (
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">{c.unclaimed}</span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      {Object.values(LeadStatus).map((status) => (
                        <td key={status} className="px-6 py-4">
                          <span className={`text-sm ${c.statusCounts[status] > 0 ? "font-semibold text-gray-800" : "text-gray-300"}`}>
                            {c.statusCounts[status]}
                          </span>
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${c.conversion >= 20 ? "text-emerald-600" : c.conversion >= 10 ? "text-amber-600" : "text-gray-500"}`}>
                          {c.conversion}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 w-24">
                          {Object.values(LeadStatus).map((status) => {
                            const pct = c.total > 0 ? Math.round((c.statusCounts[status] / c.total) * 100) : 0
                            return pct > 0 ? <div key={status} className={`h-full ${STATUS_BAR[status]}`} style={{ width: `${pct}%` }} /> : null
                          })}
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Leaderboard tab ── */}
      {tab === "leaderboard" && (() => {
        const mgmtLeaderboard = Array.from(mgmtRows.values())
          .filter((m) => m.totalLeads > 0)
          .map((m) => ({ id: m.id, name: m.name, totalLeads: m.totalLeads, won: m.won, rate: m.rate, avgResponseMs: m.avgResponseMs, notContacted: m.notContacted }))
        const leaderboardIndividuals = [
          ...individuals.map((m) => ({ id: m.id, name: m.name, totalLeads: m.totalLeads, won: m.won, rate: m.rate, avgResponseMs: m.avgResponseMs, notContacted: m.notContacted })),
          ...mgmtLeaderboard,
        ].sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)
        return <LeaderboardTabs individuals={leaderboardIndividuals} teams={teams} />
      })()}

      {/* ── Teams tab ── */}
      {tab === "teams" && teamBreakdownGroups.length > 0 && (
        <TeamBreakdownClient groups={teamBreakdownGroups} rangeQueryParams={rangeQueryParams()} />
      )}

      {tab === "tools" && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-500">Admin tools for fixing data issues. These actions are reversible — leads returned to the pool can be re-claimed by the correct team.</p>
          <MetaTokenRefreshTool />
          <RoutingAuditTool />
          <StateViolationsButton />
          <RepairBlankLeadsButton />
        </div>
      )}

    </div>
  )
}
