import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import LeaderboardTabs from "@/components/LeaderboardTabs"
import AnimatedBar from "@/components/AnimatedBar"
import { getViewAsRole } from "@/lib/viewas"

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

// Campaigns where CPL is hidden because not all leads flow through the CRM
const CPL_EXCLUDED_CAMPAIGNS = new Set(["Location Ads"])

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All time", days: 0 },
]

export default async function SuperAdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>
}) {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const { period, tab: tabParam } = await searchParams
  const tab = tabParam ?? "overview"
  const days = Number(period ?? 30)
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  const dateFilter = since ? { createdAt: { gte: since } } : {}

  const [total, byStatus, salespersonStats, managerStats, sourceStats, recentLeads, campaignLeads, mgmtStats] = await Promise.all([
    db.lead.count({ where: dateFilter }),
    db.lead.groupBy({ by: ["status"], _count: true, where: dateFilter }),
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
      take: 10,
    }),
    db.lead.findMany({
      where: dateFilter,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { assignedTo: { select: { name: true } } },
    }),
    db.lead.findMany({
      where: { ...dateFilter, campaignName: { not: null } },
      select: { campaignName: true, status: true, assignedToId: true },
    }),
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"] } },
      select: {
        id: true, name: true, role: true, managerId: true,
        leads: { where: dateFilter, select: { status: true, claimedAt: true, updatedAt: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const won = statusMap["CLOSED_WON"] ?? 0
  const lost = statusMap["CLOSED_LOST"] ?? 0
  const active = total - won - lost
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0

  // Only show leads with a known campaign name
  const sourceRows = sourceStats
    .filter((s) => s.campaignName)
    .map((s) => ({ name: s.campaignName!, count: s._count }))
  const sourcedCount = sourceRows.reduce((sum, s) => sum + s.count, 0)

  const campaignMap = new Map<string, { total: number; claimed: number; won: number; lost: number }>()
  for (const lead of campaignLeads) {
    const name = lead.campaignName!
    if (!campaignMap.has(name)) campaignMap.set(name, { total: 0, claimed: 0, won: 0, lost: 0 })
    const entry = campaignMap.get(name)!
    entry.total++
    if (lead.assignedToId) entry.claimed++
    if (lead.status === "CLOSED_WON") entry.won++
    if (lead.status === "CLOSED_LOST") entry.lost++
  }
  const campaigns = Array.from(campaignMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      claimed: s.claimed,
      unclaimed: s.total - s.claimed,
      won: s.won,
      lost: s.lost,
      conversion: s.total > 0 ? Math.round((s.won / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Meta Ads API — spend, budget, CPL per campaign
  type MetaCampaignData = {
    spendToday: number
    spendPeriod: number
    dailyBudget: number | null
    status: string
  }
  const metaData = new Map<string, MetaCampaignData>()
  const metaToken = process.env.META_PAGE_ACCESS_TOKEN
  const metaAccountId = process.env.META_AD_ACCOUNT_ID
  let metaError: string | null = null

  if (metaToken && metaAccountId) {
    try {
      const fmtDate = (d: Date) => d.toISOString().split("T")[0]
      const periodParam = since
        ? `time_range=${encodeURIComponent(JSON.stringify({ since: fmtDate(since), until: fmtDate(new Date()) }))}`
        : `date_preset=maximum`
      const base = `https://graph.facebook.com/v19.0`
      const fields = `campaign_name,spend`

      const [campsRes, todayRes, periodRes] = await Promise.all([
        fetch(`${base}/${metaAccountId}/campaigns?fields=name,daily_budget,lifetime_budget,status&access_token=${metaToken}`),
        fetch(`${base}/${metaAccountId}/insights?level=campaign&fields=${fields}&date_preset=today&access_token=${metaToken}`),
        fetch(`${base}/${metaAccountId}/insights?level=campaign&fields=${fields}&${periodParam}&access_token=${metaToken}`),
      ])
      const [campsJson, todayJson, periodJson] = await Promise.all([campsRes.json(), todayRes.json(), periodRes.json()])

      if (campsJson.error) {
        metaError = campsJson.error.message
      } else {
        const budgetMap = new Map<string, { dailyBudget: number | null; status: string }>()
        for (const c of campsJson.data ?? []) {
          budgetMap.set(c.name, {
            dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
            status: c.status ?? "UNKNOWN",
          })
        }
        const todaySpend = new Map<string, number>()
        for (const ins of todayJson.data ?? []) todaySpend.set(ins.campaign_name, Number(ins.spend ?? 0))

        for (const ins of periodJson.data ?? []) {
          const b = budgetMap.get(ins.campaign_name) ?? { dailyBudget: null, status: "UNKNOWN" }
          metaData.set(ins.campaign_name, {
            spendToday: todaySpend.get(ins.campaign_name) ?? 0,
            spendPeriod: Number(ins.spend ?? 0),
            dailyBudget: b.dailyBudget,
            status: b.status,
          })
        }
        // Add campaigns that ran but had no spend this period
        for (const [name, b] of budgetMap.entries()) {
          if (!metaData.has(name)) {
            metaData.set(name, {
              spendToday: todaySpend.get(name) ?? 0,
              spendPeriod: 0,
              dailyBudget: b.dailyBudget,
              status: b.status,
            })
          }
        }
      }
    } catch {
      metaError = "Could not reach Meta API"
    }
  }

  const rm = (v: number | null) => v == null ? "—" : `RM ${v.toFixed(2)}`

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
      return {
        id: s.id, name: s.name,
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
    return [u.id, {
      id: u.id, name: u.name, role: u.role,
      totalLeads, claimed: claimedCount, assigned: totalLeads - claimedCount,
      won: wonCount, stale: staleCount,
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

  const roleBadge = (role: string) =>
    role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Manager" : "Team Leader"

  function initials(name: string) {
    const p = name.trim().split(" ")
    return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
  }

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
    { id: "campaigns", label: "Campaigns" },
    { id: "teams", label: "Teams" },
    { id: "leaderboard", label: "Leaderboard" },
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
              const active = (days === d) || (d === 30 && !period)
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
          <Link
            href={`/superadmin/export${period ? `?period=${period}` : ""}`}
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
                  {new Date(lead.createdAt).toLocaleDateString("en-MY", { month: "short", day: "numeric" })}
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
            {metaError && (
              <span className="text-xs text-rose-500 bg-rose-50 px-3 py-1 rounded-lg border border-rose-100">
                Meta API: {metaError}
              </span>
            )}
            {!metaToken && (
              <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                Meta token not configured — ad data unavailable
              </span>
            )}
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No campaign data in this period.</div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Daily Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Today Spend</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Period Spend</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">CPL</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Unclaimed</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Conv.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => {
                  const meta = metaData.get(c.name)
                  const wonPct = c.total > 0 ? Math.round((c.won / c.total) * 100) : 0
                  const lostPct = c.total > 0 ? Math.round((c.lost / c.total) * 100) : 0
                  const activePct = 100 - wonPct - lostPct
                  const isActive = meta?.status === "ACTIVE"
                  const budgetUsedPct = meta?.dailyBudget && meta.spendToday > 0
                    ? Math.min(100, Math.round((meta.spendToday / meta.dailyBudget) * 100))
                    : null
                  return (
                    <tr key={c.name} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4 max-w-[180px]">
                        <span className="font-medium text-gray-800 text-sm truncate block">{c.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        {meta ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gray-100 text-gray-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {isActive ? "Active" : "Paused"}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{meta ? rm(meta.dailyBudget) : "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        {meta ? (
                          <div>
                            <span className="text-sm font-medium text-gray-800">{rm(meta.spendToday)}</span>
                            {budgetUsedPct !== null && (
                              <div className="mt-1 h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${budgetUsedPct >= 90 ? "bg-rose-400" : budgetUsedPct >= 70 ? "bg-amber-400" : "bg-blue-400"}`}
                                  style={{ width: `${budgetUsedPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{meta ? rm(meta.spendPeriod) : "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        {CPL_EXCLUDED_CAMPAIGNS.has(c.name) ? (
                          <span className="text-xs text-gray-300" title="CPL hidden — not all leads tracked in CRM">—</span>
                        ) : (
                          <span className="text-sm font-semibold text-violet-600">
                            {meta && meta.spendPeriod > 0 && c.total > 0 ? rm(meta.spendPeriod / c.total) : "—"}
                          </span>
                        )}
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
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-600">{c.won}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${c.conversion >= 20 ? "text-emerald-600" : c.conversion >= 10 ? "text-amber-600" : "text-gray-500"}`}>
                          {c.conversion}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 w-24">
                          {wonPct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${wonPct}%` }} />}
                          {activePct > 0 && <div className="bg-blue-400 h-full" style={{ width: `${activePct}%` }} />}
                          {lostPct > 0 && <div className="bg-rose-400 h-full" style={{ width: `${lostPct}%` }} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Leaderboard tab ── */}
      {tab === "leaderboard" && (
        <LeaderboardTabs individuals={individuals} teams={teams} />
      )}

      {/* ── Teams tab ── */}
      {tab === "teams" && teamBreakdownGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Team Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">{individuals.length} salesperson{individuals.length !== 1 ? "s" : ""} across {teamBreakdownGroups.length} team{teamBreakdownGroups.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {teamBreakdownGroups.map(({ managerId, managerName, managerRow, directMembers, subTeams }) => {
              const hasManagerLeads = managerRow && managerRow.totalLeads > 0
              const totalInTeam = directMembers.length + subTeams.reduce((s, t) => s + t.members.length, 0)
              const subGroups = [
                ...(hasManagerLeads || directMembers.length > 0 ? [{
                  label: subTeams.length > 0 ? "Direct Reports" : "",
                  headerRow: hasManagerLeads ? managerRow! : null,
                  group: directMembers,
                }] : []),
                ...subTeams.map((st) => ({
                  label: `${st.leaderName}'s Team`,
                  headerRow: st.leaderRow && st.leaderRow.totalLeads > 0 ? st.leaderRow : null,
                  group: st.members,
                })),
              ]
              return (
                <div key={managerId}>
                  {/* Top-level manager header */}
                  <div className="px-6 py-3 bg-violet-50/50 border-b border-violet-100/60 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-700">{initials(managerName)}</span>
                    </div>
                    <span className="text-sm font-bold text-violet-800">{managerName}&apos;s Team</span>
                    <span className="text-xs text-violet-400">· {totalInTeam} member{totalInTeam !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Sub-groups */}
                  <div className="divide-y divide-gray-50">
                    {subGroups.map(({ label, headerRow, group }) => {
                      const count = group.length + (headerRow ? 1 : 0)
                      return (
                      <div key={label || "direct"}>
                        {label && (
                          <div className="px-6 py-2 bg-gray-50/60">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label} · {count} member{count !== 1 ? "s" : ""}</p>
                          </div>
                        )}

                        {/* Mobile cards */}
                        <ul className="sm:hidden divide-y divide-gray-50">
                          {headerRow && (
                            <li className="px-5 py-4 bg-violet-50/30">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-violet-800">{initials(headerRow.name)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 truncate">{headerRow.name}</p>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{roleBadge(headerRow.role)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                                    <span>{headerRow.claimed} claimed</span>
                                    <span>{headerRow.assigned} assigned</span>
                                    <span className="text-emerald-600 font-semibold">{headerRow.won} won</span>
                                    <span className={`font-bold ${headerRow.rate >= 20 ? "text-emerald-600" : headerRow.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{headerRow.rate}%</span>
                                    {headerRow.stale > 0 && <span className="text-rose-500 font-medium">{headerRow.stale} stale</span>}
                                  </div>
                                </div>
                              </div>
                            </li>
                          )}
                          {group.map((m, i) => (
                            <li key={m.id} className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-violet-600">{initials(m.name)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                                    {i === 0 && m.won > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Top</span>}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                                    <span>{m.claimed} claimed</span>
                                    <span>{m.assigned} assigned</span>
                                    <span className="text-emerald-600 font-semibold">{m.won} won</span>
                                    <span className={`font-bold ${m.rate >= 20 ? "text-emerald-600" : m.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{m.rate}%</span>
                                    {m.stale > 0 && <span className="text-rose-500 font-medium">{m.stale} stale</span>}
                                  </div>
                                </div>
                                <div className="shrink-0 w-16">
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    {m.totalLeads > 0 && <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.rate}%` }} />}
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>

                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="border-b border-gray-50 bg-gray-50/20">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Claimed</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Conv.</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Stale</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {headerRow && (
                                <tr className="bg-violet-50/20 hover:bg-violet-50/40 transition">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-violet-800">{initials(headerRow.name)}</span>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{headerRow.name}</p>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{roleBadge(headerRow.role)}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4"><span className="text-sm font-semibold text-blue-600">{headerRow.claimed}</span></td>
                                  <td className="px-6 py-4"><span className="text-sm text-gray-500">{headerRow.assigned}</span></td>
                                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{headerRow.totalLeads}</td>
                                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{headerRow.won}</td>
                                  <td className="px-6 py-4">
                                    <span className={`text-sm font-bold ${headerRow.rate >= 20 ? "text-emerald-600" : headerRow.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{headerRow.rate}%</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {headerRow.stale > 0
                                      ? <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{headerRow.stale}</span>
                                      : <span className="text-xs text-emerald-600 font-medium">—</span>}
                                  </td>
                                </tr>
                              )}
                              {group.map((m, i) => (
                                <tr key={m.id} className="hover:bg-gray-50/70 transition">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-violet-600">{initials(m.name)}</span>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{m.name}</p>
                                        {i === 0 && m.won > 0 && <p className="text-[10px] text-amber-600 font-semibold">Top performer</p>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm font-semibold text-blue-600">{m.claimed}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-500">{m.assigned}</span>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{m.totalLeads}</td>
                                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{m.won}</td>
                                  <td className="px-6 py-4">
                                    <span className={`text-sm font-bold ${m.rate >= 20 ? "text-emerald-600" : m.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{m.rate}%</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {m.stale > 0 ? (
                                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{m.stale}</span>
                                    ) : (
                                      <span className="text-xs text-emerald-600 font-medium">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
