import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"
import LeadsFilters from "@/components/LeadsFilters"

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

type LeadRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  status: LeadStatus
  isDuplicate: boolean
  campaignName?: string | null
  adName?: string | null
  createdAt: Date
  updatedAt: Date
  assignedTo?: { id: string; name: string } | null
  _count: { notes: number }
}

function LeadsTable({ leads, showAssignedTo }: { leads: LeadRow[]; showAssignedTo: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            {showAssignedTo && (
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</th>
            )}
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.length === 0 && (
            <tr>
              <td colSpan={showAssignedTo ? 7 : 6} className="text-center py-12 text-sm text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  No leads found.
                </div>
              </td>
            </tr>
          )}
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-50/70 transition">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-600">
                      {(lead.firstName?.[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition text-sm">
                      {lead.firstName} {lead.lastName}
                    </Link>
                    {lead.isDuplicate && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ring-1 ring-amber-200">DUP</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-sm">
                <div className="text-gray-700">{lead.email ?? "—"}</div>
                {lead.phone && <div className="text-gray-400 text-xs mt-0.5">{lead.phone}</div>}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-col gap-1">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
                    {STATUS_LABELS[lead.status]}
                  </span>
                  {lead.status !== "CLOSED_WON" && lead.status !== "CLOSED_LOST" && (() => {
                    const days = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86400000)
                    if (days < 2) return null
                    return (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded w-fit ${days >= 7 ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-600"}`}>
                        {days}d untouched
                      </span>
                    )
                  })()}
                </div>
              </td>
              {showAssignedTo && (
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {lead.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-violet-600">{lead.assignedTo.name[0].toUpperCase()}</span>
                      </div>
                      <span>{lead.assignedTo.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">Unassigned</span>
                  )}
                </td>
              )}
              <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[140px] truncate">
                {lead.campaignName ?? lead.adName ?? "—"}
              </td>
              <td className="px-5 py-3.5">
                {lead._count.notes > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {lead._count.notes}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-xs text-gray-400">
                {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const includeOpts = {
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { notes: true } },
} as const

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToId?: string; search?: string; source?: string }>
}) {
  const session = await auth()
  const role = session?.user.role
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isTeamLeaderRole = role === "TEAM_LEADER"
  const isAdmin = isSuperAdmin || isManager || isTeamLeaderRole
  const { status, assignedToId, search, source } = await searchParams

  // Common filters that apply regardless of role
  const commonClauses: Record<string, unknown>[] = []
  if (status) commonClauses.push({ status: status as LeadStatus })
  if (source) commonClauses.push({ campaignName: source })
  if (search) {
    commonClauses.push({ OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ]})
  }

  const orderBy = { createdAt: "desc" } as const

  // Admin (manager or super admin) with no assignedToId filter → split into two sections
  const splitView = isAdmin && !assignedToId

  let myLeads: LeadRow[] = []
  let teamLeads: LeadRow[] = []
  let otherLeads: LeadRow[] = []
  let leads: LeadRow[] = []

  const [salespeople, sources] = await Promise.all([
    isAdmin
      ? db.user.findMany({
          where: isManager
            ? {
                role: "SALESPERSON",
                OR: [
                  { managerId: session!.user.id },
                  { manager: { managerId: session!.user.id } },
                ],
              }
            : { role: "SALESPERSON", managerId: session!.user.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.lead.findMany({
      where: { campaignName: { not: null } },
      select: { campaignName: true },
      distinct: ["campaignName"],
      orderBy: { campaignName: "asc" },
    }),
  ])

  if (splitView) {
    // ADMIN sees team leads from both direct reports and team leaders' reports
    const teamLeadsWhere = isManager
      ? {
          AND: [
            {
              OR: [
                { assignedTo: { managerId: session!.user.id } },
                { assignedTo: { manager: { managerId: session!.user.id } } },
              ],
            },
            ...commonClauses,
          ],
        }
      : { AND: [{ assignedTo: { managerId: session!.user.id } }, ...commonClauses] }

    const queries: Promise<LeadRow[]>[] = [
      db.lead.findMany({
        where: { AND: [{ assignedToId: session!.user.id }, ...commonClauses] },
        include: includeOpts,
        orderBy,
      }),
      db.lead.findMany({
        where: teamLeadsWhere,
        include: includeOpts,
        orderBy,
      }),
    ]
    if (isSuperAdmin) {
      queries.push(
        db.lead.findMany({
          where: {
            AND: [
              { NOT: { assignedToId: session!.user.id } },
              { NOT: { assignedTo: { managerId: session!.user.id } } },
              ...commonClauses,
            ],
          },
          include: includeOpts,
          orderBy,
        })
      )
    }
    const results = await Promise.all(queries)
    myLeads = results[0]
    teamLeads = results[1]
    if (isSuperAdmin) otherLeads = results[2] ?? []
  } else {
    const andClauses = [...commonClauses]

    if (isAdmin) {
      // assignedToId filter active — filter to that person (super admin: also supports "unassigned")
      if (isSuperAdmin && assignedToId === "unassigned") andClauses.push({ assignedToId: null })
      else if (assignedToId) andClauses.push({ assignedToId })
      else andClauses.push({ OR: [{ assignedToId: session!.user.id }, { assignedTo: { managerId: session!.user.id } }] })
    } else {
      andClauses.push({ assignedToId: session?.user.id })
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : {}
    leads = await db.lead.findMany({ where, include: includeOpts, orderBy })
  }

  const totalCount = splitView ? myLeads.length + teamLeads.length + otherLeads.length : leads.length

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount} leads total</p>
        </div>
      </div>

      <LeadsFilters isAdmin={isAdmin} salespeople={salespeople} sources={sources.map(s => s.campaignName!)} />

      {splitView ? (
        <div className="space-y-7">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              My Leads
              <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{myLeads.length} leads</span>
            </h2>
            <LeadsTable leads={myLeads} showAssignedTo={false} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Team Leads
              <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{teamLeads.length} leads</span>
            </h2>
            <LeadsTable leads={teamLeads} showAssignedTo={true} />
          </div>

          {isSuperAdmin && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                All Other Leads
                <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{otherLeads.length} leads</span>
              </h2>
              <LeadsTable leads={otherLeads} showAssignedTo={true} />
            </div>
          )}
        </div>
      ) : (
        <LeadsTable leads={leads} showAssignedTo={isAdmin} />
      )}
    </div>
  )
}
