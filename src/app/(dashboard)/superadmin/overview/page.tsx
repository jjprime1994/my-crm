import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import LeaderboardTabs from "@/components/LeaderboardTabs"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Proposal", CLOSED_WON: "Closed Won", CLOSED_LOST: "Closed Lost",
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
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth()
  if (!isSuperAdmin(session?.user.role)) redirect("/")

  const { period } = await searchParams
  const days = Number(period ?? 30)
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  const dateFilter = since ? { createdAt: { gte: since } } : {}

  const [total, byStatus, salespersonStats, managerStats, sourceStats, recentLeads] = await Promise.all([
    db.lead.count({ where: dateFilter }),
    db.lead.groupBy({ by: ["status"], _count: true, where: dateFilter }),
    db.user.findMany({
      where: { role: "SALESPERSON" },
      select: {
        id: true, name: true,
        _count: { select: { leads: true } },
        leads: { where: dateFilter, select: { status: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true, name: true,
        teamMembers: {
          where: { role: "SALESPERSON" },
          select: {
            _count: { select: { leads: true } },
            leads: { where: dateFilter, select: { status: true } },
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

  const individuals = salespersonStats
    .map((s) => {
      const wonCount = s.leads.filter((l) => l.status === "CLOSED_WON").length
      const totalLeads = s.leads.length
      return { id: s.id, name: s.name, totalLeads, won: wonCount, rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0 }
    })
    .sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  const teams = managerStats
    .map((m) => {
      const totalLeads = m.teamMembers.reduce((sum, tm) => sum + tm.leads.length, 0)
      const wonCount = m.teamMembers.reduce((sum, tm) => sum + tm.leads.filter((l) => l.status === "CLOSED_WON").length, 0)
      return { managerId: m.id, managerName: m.name, memberCount: m.teamMembers.length, totalLeads, won: wonCount, rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0 }
    })
    .filter((t) => t.memberCount > 0)
    .sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  const periodLabel = days === 0 ? "All time" : `Last ${days} days`

  return (
    <div className="space-y-8 max-w-6xl">
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
                  href={d === 0 ? "?period=0" : d === 30 ? "?" : `?period=${d}`}
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

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: total, color: "text-gray-900", bg: "bg-gray-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: "Active Pipeline", value: active, color: "text-blue-600", bg: "bg-blue-50",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
          { label: "Closed Won", value: won, color: "text-emerald-600", bg: "bg-emerald-50",
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
                    <div className={`h-full rounded-full ${STATUS_BAR[status]} transition-all`} style={{ width: `${pct}%` }} />
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

      {/* Leaderboard */}
      <LeaderboardTabs individuals={individuals} teams={teams} />

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
    </div>
  )
}
