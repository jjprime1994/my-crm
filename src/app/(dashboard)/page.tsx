import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import { getViewAsRole } from "@/lib/viewas"
import AnimatedBar from "@/components/AnimatedBar"
import ResetLimitsButton from "@/components/ResetLimitsButton"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  CONTACTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  QUALIFIED: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  PROPOSAL: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  CLOSED_WON: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CLOSED_LOST: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
}

const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-500",
}

const STATUS_BAR: Record<LeadStatus, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-400",
}

function StatCard({ label, value, valueClass = "text-gray-900", sub, icon }: {
  label: string; value: React.ReactNode; valueClass?: string; sub?: React.ReactNode; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl sm:text-3xl font-bold mt-1 ${valueClass}`}>{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
      <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400 shrink-0">{icon}</div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isTeamLeaderRole = role === "TEAM_LEADER"
  const isAdmin = isSuperAdmin || isManager || isTeamLeaderRole

  // TEAM_LEADER sees their own leads + team members' leads
  const where = isTeamLeaderRole
    ? { OR: [{ assignedToId: session?.user.id }, { assignedTo: { managerId: session?.user.id } }] }
    : isAdmin
    ? {}
    : { assignedToId: session?.user.id }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)

  const teamMembersWhere = isAdmin
    ? isSuperAdmin
      ? {}
      : isManager
      ? {
          role: "SALESPERSON" as const,
          OR: [
            { managerId: session!.user.id },
            { manager: { managerId: session!.user.id } },
          ],
        }
      : { role: "SALESPERSON" as const, managerId: session!.user.id }
    : null

  const [total, byStatus, recent, followUpCount, unassignedCount, teamMembers, wonCounts, todayClaimCounts] = await Promise.all([
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["status"], _count: true, where }),
    isSuperAdmin
      ? db.lead.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { assignedTo: { select: { name: true } } },
        })
      : Promise.resolve([]),
    db.lead.count({
      where: {
        ...where,
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        updatedAt: { lt: twoDaysAgo },
      },
    }),
    isAdmin ? db.lead.count({ where: { assignedToId: null } }) : Promise.resolve(0),
    teamMembersWhere
      ? db.user.findMany({
          where: teamMembersWhere,
          select: { id: true, name: true, role: true, claimLimit: true, _count: { select: { leads: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    teamMembersWhere
      ? db.lead.groupBy({
          by: ["assignedToId"],
          where: { status: "CLOSED_WON" },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teamMembersWhere
      ? db.lead.groupBy({
          by: ["assignedToId"],
          where: { claimedAt: { gte: startOfDayUTC } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ])

  const wonByUserId = Object.fromEntries(wonCounts.map((r) => [r.assignedToId, r._count.id]))
  const claimedTodayById = Object.fromEntries(todayClaimCounts.map((r) => [r.assignedToId, r._count.id]))
  const teamStats = teamMembers.map((m) => ({
    ...m,
    won: wonByUserId[m.id] ?? 0,
    claimedToday: claimedTodayById[m.id] ?? 0,
  }))
  const atLimitCount = teamStats.filter((m) => m.claimedToday >= m.claimLimit).length
  const atLimitPct = teamStats.length > 0 ? Math.round((atLimitCount / teamStats.length) * 100) : 0

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const wonCount = statusMap["CLOSED_WON"] ?? 0
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0

  return (
    <div className="space-y-7 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isAdmin ? "Overview of your entire team's pipeline" : "Your personal pipeline overview"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={total}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          valueClass="text-emerald-600"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
        />
        <StatCard
          label="Need Follow-up"
          value={followUpCount}
          valueClass={followUpCount > 0 ? "text-orange-500" : "text-gray-900"}
          sub={followUpCount > 0 && (
            <Link href="/follow-ups" className="text-xs text-orange-500 hover:text-orange-600 font-medium">
              View all →
            </Link>
          )}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={followUpCount > 0 ? "#f97316" : "currentColor"} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
        />
        {isAdmin ? (
          <StatCard
            label="At Daily Limit"
            value={`${atLimitCount} / ${teamStats.length}`}
            valueClass={atLimitCount > 0 ? "text-rose-500" : "text-gray-900"}
            sub={
              <div>
                <p className={`text-xs font-medium ${atLimitCount > 0 ? "text-rose-400" : "text-gray-400"}`}>
                  {atLimitPct}% of team at limit
                </p>
                {isSuperAdmin && <ResetLimitsButton />}
              </div>
            }
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={atLimitCount > 0 ? "#f43f5e" : "currentColor"} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
        ) : (
          <StatCard
            label="Won"
            value={wonCount}
            valueClass="text-emerald-600"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
          />
        )}
      </div>

      {/* Pipeline */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.values(LeadStatus).map((status) => {
            const count = statusMap[status] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={status} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                  <p className="text-xs text-gray-500 font-medium">{STATUS_LABELS[status]}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <AnimatedBar pct={pct} className={STATUS_BAR[status]} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent leads — super admin only */}
        {isSuperAdmin && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Recent Leads</h2>
              <Link href="/leads" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-gray-50">
              {recent.length === 0 && (
                <li className="px-6 py-10 text-center text-sm text-gray-400">No leads yet.</li>
              )}
              {recent.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">
                        {(lead.firstName?.[0] ?? "?").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{lead.email ?? lead.phone ?? "—"}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Team performance */}
        {isAdmin && teamStats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Team Performance</h2>
              <Link href="/admin/users" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Manage →
              </Link>
            </div>
            <ul className="divide-y divide-gray-50">
              {teamStats.map((member) => {
                const won = member.won
                const rate = member._count.leads > 0 ? Math.round((won / member._count.leads) * 100) : 0
                const atLimit = member.claimedToday >= member.claimLimit
                const claimPct = member.claimLimit > 0 ? Math.min(100, Math.round((member.claimedToday / member.claimLimit) * 100)) : 0
                return (
                  <li key={member.id} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${atLimit ? "bg-rose-100" : "bg-violet-100"}`}>
                      <span className={`text-xs font-bold ${atLimit ? "text-rose-500" : "text-violet-600"}`}>
                        {(member.name?.[0] ?? "?").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm truncate">{member.name}</p>
                        {isSuperAdmin && member.role !== "SALESPERSON" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-200 shrink-0">
                            {member.role === "SUPER_ADMIN" ? "Super Admin" : member.role === "ADMIN" ? "Manager" : "Team Leader"}
                          </span>
                        )}
                        {atLimit && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-200 shrink-0">At limit</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <AnimatedBar pct={claimPct} className={atLimit ? "bg-rose-400" : "bg-blue-400"} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{member.claimedToday}/{member.claimLimit} claimed</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{rate}%</p>
                      <p className="text-xs text-gray-400">{member._count.leads} leads</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
