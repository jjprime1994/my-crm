import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import LeadsFilters from "@/components/LeadsFilters"
import { getViewAsRole } from "@/lib/viewas"
import LeadsTable, { type LeadRow } from "@/components/LeadsTable"

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
  const role = await getViewAsRole(session?.user.role)
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isTeamLeaderRole = role === "TEAM_LEADER"
  const isAdmin = isSuperAdmin || isManager || isTeamLeaderRole
  const { status, assignedToId, search, source } = await searchParams

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
