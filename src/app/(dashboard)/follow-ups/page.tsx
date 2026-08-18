import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import { getViewAsRole } from "@/lib/viewas"
import Pagination from "@/components/Pagination"
import ContactButtons from "@/components/ContactButtons"

const PAGE_SIZE = 50

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  CONTACTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  QUALIFIED: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  PROPOSAL: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
}

const STATUS_DOT: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500",
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Appointment Made",
}

function daysAgo(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

type LeadRow = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  status: LeadStatus
  updatedAt: Date
  followUpAt: Date | null
  assignedTo: { name: string } | null
}

function LeadList({ leads, showAssignee, emptyLabel }: { leads: LeadRow[]; showAssignee: boolean; emptyLabel: string }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-10 text-sm text-gray-400">
            {emptyLabel}
          </div>
        ) : leads.map((lead) => {
          const days = daysAgo(lead.updatedAt)
          const urgent = days >= 5
          return (
            <div key={lead.id} className={`relative rounded-xl border shadow-sm px-4 py-3.5 ${urgent ? "bg-rose-50/60 border-rose-200" : "bg-white border-gray-100"}`}>
              <Link href={`/leads/${lead.id}`} className="absolute inset-0 rounded-xl" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${urgent ? "bg-rose-100" : "bg-orange-100"}`}>
                    <span className={`text-xs font-bold ${urgent ? "text-rose-600" : "text-orange-600"}`}>
                      {(lead.firstName?.[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 text-sm">{lead.firstName} {lead.lastName}</span>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{lead.email ?? lead.phone ?? "—"}</p>
                  </div>
                </div>
                {lead.followUpAt ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Reminder</span>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${urgent ? "bg-rose-100 text-rose-600" : "bg-orange-100 text-orange-600"}`}>
                    {days}d overdue
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2.5 ml-12 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status] ?? "bg-gray-400"}`} />
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
                {showAssignee && lead.assignedTo && (
                  <span className="text-xs text-gray-500">{lead.assignedTo.name}</span>
                )}
                {lead.phone && (
                  <div className="flex gap-1.5 ml-auto relative">
                    <ContactButtons
                      leadId={lead.id}
                      phone={lead.phone}
                      waLabel="WA"
                      waClassName="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-200"
                      callClassName="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg ring-1 ring-blue-200"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Lead</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Waiting</th>
              {showAssignee && <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</th>}
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={showAssignee ? 6 : 5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><polyline points="20 6 9 17 4 12"/></svg>
                    {emptyLabel}
                  </div>
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const days = daysAgo(lead.updatedAt)
              const urgent = days >= 5
              return (
                <tr key={lead.id} className={`transition ${urgent ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-gray-50/70"}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${urgent ? "bg-rose-100" : "bg-orange-100"}`}>
                        <span className={`text-xs font-bold ${urgent ? "text-rose-600" : "text-orange-600"}`}>
                          {(lead.firstName?.[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                      <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition text-sm">
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <div className="text-gray-700">{lead.email ?? "—"}</div>
                    {lead.phone && <div className="text-gray-400 text-xs mt-0.5">{lead.phone}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status] ?? "bg-gray-400"}`} />
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {lead.followUpAt ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Reminder set
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${urgent ? "bg-rose-100 text-rose-600" : "bg-orange-100 text-orange-600"}`}>
                        {urgent && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                        {days}d overdue
                      </span>
                    )}
                  </td>
                  {showAssignee && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {lead.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-violet-600">{lead.assignedTo.name[0].toUpperCase()}</span>
                          </div>
                          <span>{lead.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {lead.phone && (
                        <ContactButtons
                          leadId={lead.id}
                          phone={lead.phone}
                          waLabel="WhatsApp"
                          waClassName="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition ring-1 ring-emerald-200"
                          callClassName="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition ring-1 ring-blue-200"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; myPage?: string; teamPage?: string }>
}) {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isTeamLeader = role === "TEAM_LEADER"
  const isAdminRole = isSuperAdmin || isManager || isTeamLeader

  const { page: pageParam, myPage: myPageParam, teamPage: teamPageParam } = await searchParams
  const page     = Math.max(1, Number(pageParam     ?? "1"))
  const myPage   = Math.max(1, Number(myPageParam   ?? "1"))
  const teamPage = Math.max(1, Number(teamPageParam ?? "1"))

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const statusFilter = { status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] as LeadStatus[] } }
  const staleness = {
    OR: [
      { followUpAt: { lte: new Date() } },
      { followUpAt: null, updatedAt: { lt: twoDaysAgo } },
    ],
  }
  const include = { assignedTo: { select: { name: true } } }
  const orderBy = { updatedAt: "asc" as const }

  if (!isAdminRole) {
    const where = { AND: [statusFilter, staleness, { assignedToId: session?.user.id }] }
    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({ where, include, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ])
    return (
      <div className="space-y-5 max-w-[1300px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
            <p className="text-sm text-gray-500 mt-0.5">Leads not updated in 2+ days</p>
          </div>
          <span className={`text-sm font-semibold px-3.5 py-1.5 rounded-full ${total > 0 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
            {total} need attention
          </span>
        </div>
        <LeadList leads={leads} showAssignee={false} emptyLabel="All caught up — no follow-ups needed." />
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} pageParam="page" basePath="/follow-ups" />
      </div>
    )
  }

  // Admin / Manager / Team Leader: split own vs team
  const myFilter = { AND: [statusFilter, staleness, { assignedToId: session!.user.id }] }

  const teamScopeFilter = isSuperAdmin
    ? { NOT: { assignedToId: session!.user.id } }
    : isManager
    ? {
        OR: [
          { assignedTo: { managerId: session!.user.id } },
          { assignedTo: { manager: { managerId: session!.user.id } } },
        ],
        NOT: { assignedToId: session!.user.id },
      }
    : { assignedTo: { managerId: session!.user.id }, NOT: { assignedToId: session!.user.id } }

  const teamFilter = { AND: [statusFilter, staleness, teamScopeFilter] }

  const [myTotal, myLeads, teamTotal, teamLeads] = await Promise.all([
    db.lead.count({ where: myFilter }),
    db.lead.findMany({ where: myFilter, include, orderBy, skip: (myPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.lead.count({ where: teamFilter }),
    db.lead.findMany({ where: teamFilter, include, orderBy, skip: (teamPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])

  const total = myTotal + teamTotal

  return (
    <div className="space-y-7 max-w-[1300px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leads not updated in 2+ days</p>
        </div>
        <span className={`text-sm font-semibold px-3.5 py-1.5 rounded-full ${total > 0 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
          {total} need attention
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Leads</h2>
          {myTotal > 0 && (
            <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{myTotal}</span>
          )}
        </div>
        <LeadList leads={myLeads} showAssignee={false} emptyLabel="No personal follow-ups — you're all caught up." />
        <Pagination page={myPage} totalPages={Math.ceil(myTotal / PAGE_SIZE)} pageParam="myPage" basePath="/follow-ups" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {isSuperAdmin ? "All Team Leads" : "My Team's Leads"}
          </h2>
          {teamTotal > 0 && (
            <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{teamTotal}</span>
          )}
        </div>
        <LeadList leads={teamLeads} showAssignee emptyLabel="No team follow-ups needed." />
        <Pagination page={teamPage} totalPages={Math.ceil(teamTotal / PAGE_SIZE)} pageParam="teamPage" basePath="/follow-ups" />
      </div>
    </div>
  )
}
