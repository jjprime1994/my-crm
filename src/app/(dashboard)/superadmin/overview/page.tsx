import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"

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

export default async function SuperAdminOverviewPage() {
  const session = await auth()
  if (!isSuperAdmin(session?.user.role)) redirect("/")

  const [total, byStatus, teamStats, sourceStats, recentLeads] = await Promise.all([
    db.lead.count(),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.user.findMany({
      where: { role: { in: ["SALESPERSON", "ADMIN"] } },
      select: {
        id: true, name: true, role: true,
        _count: { select: { leads: true } },
        leads: { select: { status: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.lead.groupBy({ by: ["adName"], _count: true, orderBy: { _count: { adName: "desc" } }, take: 10 }),
    db.lead.findMany({
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

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Business Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete view of all leads and team performance</p>
        </div>
        <Link
          href="/superadmin/export"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-violet-200"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Leads
        </Link>
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
            <span className="text-xs text-gray-400">Top 10 by volume</span>
          </div>
          {sourceStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No source data yet.</p>
          ) : (
            <div className="space-y-3">
              {sourceStats.map((s, i) => {
                const pct = total > 0 ? Math.round((s._count / total) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600 truncate max-w-[200px]">{s.adName ?? "Unknown"}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs">{pct}%</span>
                        <span className="font-semibold text-gray-900 w-6 text-right">{s._count}</span>
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

      {/* Team leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Team Leaderboard</h2>
          <Link href="/admin/users" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage →</Link>
        </div>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/40">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Won</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide min-w-[160px]">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teamStats.map((member) => {
              const memberWon = member.leads.filter((l) => l.status === "CLOSED_WON").length
              const rate = member._count.leads > 0 ? Math.round((memberWon / member._count.leads) * 100) : 0
              return (
                <tr key={member.id} className="hover:bg-gray-50/70 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-violet-600">{member.name[0].toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${member.role === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
                      {member.role === "ADMIN" ? "Admin" : "Salesperson"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{member._count.leads}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{memberWon}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-sm font-bold text-emerald-600 w-10 text-right">{rate}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                <td className="px-6 py-3.5 text-sm text-gray-500 max-w-[150px] truncate">{lead.adName ?? "—"}</td>
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
