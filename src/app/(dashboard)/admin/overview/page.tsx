import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isManagerLevel } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"

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

export default async function ManagerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth()
  if (!isManagerLevel(session?.user.role)) redirect("/")
  if (session?.user.role === "SUPER_ADMIN") redirect("/superadmin/overview")

  const { period } = await searchParams
  const days = Number(period ?? 30)
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  const dateFilter = since ? { createdAt: { gte: since } } : {}
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const isFullManager = isAdmin(session!.user.role)

  // ADMIN sees all salespeople in their extended team (including under team leaders)
  // TEAM_LEADER sees only their direct salesperson reports
  const salespersonWhere = isFullManager
    ? {
        role: "SALESPERSON" as const,
        OR: [
          { managerId: session!.user.id },
          { manager: { managerId: session!.user.id } },
        ],
      }
    : { role: "SALESPERSON" as const, managerId: session!.user.id }

  const leadsAssignedWhere = isFullManager
    ? {
        OR: [
          { assignedTo: { managerId: session!.user.id } },
          { assignedTo: { manager: { managerId: session!.user.id } } },
        ],
      }
    : { assignedTo: { managerId: session!.user.id } }

  const [teamMembers, byStatus, overdueCount] = await Promise.all([
    db.user.findMany({
      where: salespersonWhere,
      select: {
        id: true,
        name: true,
        leads: {
          where: dateFilter,
          select: { status: true, updatedAt: true },
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
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0)
  const won = statusMap["CLOSED_WON"] ?? 0
  const lost = statusMap["CLOSED_LOST"] ?? 0
  const active = total - won - lost
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0

  const members = teamMembers.map((m) => {
    const totalLeads = m.leads.length
    const wonCount = m.leads.filter((l) => l.status === "CLOSED_WON").length
    const staleCount = m.leads.filter((l) =>
      l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST" &&
      (Date.now() - new Date(l.updatedAt).getTime()) > 2 * 86400000
    ).length
    return {
      id: m.id,
      name: m.name,
      totalLeads,
      won: wonCount,
      stale: staleCount,
      rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
    }
  }).sort((a, b) => b.won - a.won || b.totalLeads - a.totalLeads)

  const periodLabel = days === 0 ? "All time" : `Last ${days} days`

  function initials(name: string) {
    const p = name.trim().split(" ")
    return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">{session!.user.role === "TEAM_LEADER" ? "Team Leader" : "Manager"}</p>
          <h1 className="text-2xl font-bold text-gray-900">Team Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
          {PERIODS.map(({ label, days: d }) => {
            const isActive = (days === d) || (d === 30 && !period)
            return (
              <Link
                key={label}
                href={d === 0 ? "?period=0" : d === 30 ? "?" : `?period=${d}`}
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

      {/* Pipeline + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Pipeline Funnel</h2>
          {total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No leads in this period.</p>
          ) : (
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

      {/* Team leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Team Performance</h2>
          <p className="text-xs text-gray-400 mt-0.5">{members.length} salesperson{members.length !== 1 ? "s" : ""}</p>
        </div>
        {members.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No team members yet.</div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="sm:hidden divide-y divide-gray-50">
              {members.map((m, i) => (
                <li key={m.id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{initials(m.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                        {i === 0 && m.won > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">⭐ Top</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                        <span>{m.totalLeads} leads</span>
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
                  <tr className="border-b border-gray-50 bg-gray-50/40">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Salesperson</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Conv.</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Stale Leads</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-32">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((m, i) => (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-600">{initials(m.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{m.name}</p>
                            {i === 0 && m.won > 0 && <p className="text-[10px] text-amber-600 font-semibold">Top performer</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{m.totalLeads}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{m.won}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${m.rate >= 20 ? "text-emerald-600" : m.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{m.rate}%</span>
                      </td>
                      <td className="px-6 py-4">
                        {m.stale > 0 ? (
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{m.stale} stale</span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">All active</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-28">
                          {m.totalLeads > 0 && <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.rate}%` }} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
