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
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToId?: string; search?: string; source?: string }>
}) {
  const session = await auth()
  const role = session?.user.role
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isAdmin = isSuperAdmin || isManager
  const { status, assignedToId, search, source } = await searchParams

  const where: Record<string, unknown> = {}
  if (status) where.status = status as LeadStatus
  if (source) where.campaignName = source
  if (isSuperAdmin) {
    // super admin sees everything
    if (assignedToId === "unassigned") where.assignedToId = null
    else if (assignedToId) where.assignedToId = assignedToId
  } else if (isManager) {
    // manager sees only leads assigned to their team members
    where.assignedTo = { managerId: session!.user.id }
    if (assignedToId) where.assignedToId = assignedToId
  } else {
    // salesperson sees only their own leads
    where.assignedToId = session?.user.id
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ]
  }

  const [leads, salespeople, sources] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { notes: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? db.user.findMany({
          where: { role: "SALESPERSON", ...(isManager ? { managerId: session!.user.id } : {}) },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.lead.findMany({ where: { campaignName: { not: null } }, select: { campaignName: true }, distinct: ["campaignName"], orderBy: { campaignName: "asc" } }),
  ])

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} leads total</p>
        </div>
      </div>

      <LeadsFilters isAdmin={isAdmin} salespeople={salespeople} sources={sources.map(s => s.campaignName!)} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              {isAdmin && (
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
                <td colSpan={7} className="text-center py-16 text-sm text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
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
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                {isAdmin && (
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
    </div>
  )
}
