import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import LeadsFilters from "@/components/LeadsFilters"
import { getViewAsRole } from "@/lib/viewas"
import LeadsTable, { type LeadRow } from "@/components/LeadsTable"
import Pagination from "@/components/Pagination"

const PAGE_SIZE = 50

const includeOpts = {
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { notes: true } },
} as const

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToId?: string; search?: string; source?: string; page?: string; myPage?: string; teamPage?: string; otherPage?: string }>
}) {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isManager = role === "ADMIN"
  const isTeamLeaderRole = role === "TEAM_LEADER"
  const isAdmin = isSuperAdmin || isManager || isTeamLeaderRole
  const { status, assignedToId, search, source, page: pageParam, myPage: myPageParam, teamPage: teamPageParam, otherPage: otherPageParam } = await searchParams

  const page     = Math.max(1, Number(pageParam     ?? "1"))
  const myPage   = Math.max(1, Number(myPageParam   ?? "1"))
  const teamPage = Math.max(1, Number(teamPageParam ?? "1"))
  const otherPage = Math.max(1, Number(otherPageParam ?? "1"))

  const commonClauses: Record<string, unknown>[] = []
  if (status) commonClauses.push({ status: status as LeadStatus })
  if (source) commonClauses.push({ campaignName: source })
  if (search) {
    commonClauses.push({ OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { assignedTo: { name: { contains: search, mode: "insensitive" } } },
    ]})
  }

  const orderBy = { createdAt: "desc" } as const
  const splitView = isAdmin && !assignedToId && !search

  let myLeads: LeadRow[] = []
  let teamLeads: LeadRow[] = []
  let otherLeads: LeadRow[] = []
  let leads: LeadRow[] = []
  let myTotal = 0, teamTotal = 0, otherTotal = 0, singleTotal = 0

  const [salespeople, sources] = await Promise.all([
    isAdmin
      ? db.user.findMany({
          where: isSuperAdmin
            ? { role: "SALESPERSON" }
            : isManager
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
    const myWhere = { AND: [{ assignedToId: session!.user.id }, ...commonClauses] }
    const teamWhere = isManager
      ? { AND: [{ OR: [{ assignedTo: { managerId: session!.user.id } }, { assignedTo: { manager: { managerId: session!.user.id } } }] }, ...commonClauses] }
      : { AND: [{ assignedTo: { managerId: session!.user.id } }, ...commonClauses] }
    const otherWhere = {
      AND: [
        { NOT: { assignedToId: session!.user.id } },
        { NOT: { assignedTo: { managerId: session!.user.id } } },
        ...commonClauses,
      ],
    }

    const queries = [
      db.lead.count({ where: myWhere }),
      db.lead.findMany({ where: myWhere, include: includeOpts, orderBy, skip: (myPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      db.lead.count({ where: teamWhere }),
      db.lead.findMany({ where: teamWhere, include: includeOpts, orderBy, skip: (teamPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      ...(isSuperAdmin ? [
        db.lead.count({ where: otherWhere }),
        db.lead.findMany({ where: otherWhere, include: includeOpts, orderBy, skip: (otherPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      ] : []),
    ]

    const results = await Promise.all(queries)
    myTotal   = results[0] as number
    myLeads   = results[1] as LeadRow[]
    teamTotal = results[2] as number
    teamLeads = results[3] as LeadRow[]
    if (isSuperAdmin) {
      otherTotal = results[4] as number
      otherLeads = results[5] as LeadRow[]
    }
  } else {
    const andClauses = [...commonClauses]
    if (isAdmin) {
      if (isSuperAdmin && assignedToId === "unassigned") andClauses.push({ assignedToId: null })
      else if (assignedToId) andClauses.push({ assignedToId })
      else if (isSuperAdmin) { /* no scope restriction — super admin sees all */ }
      else if (isManager) andClauses.push({ OR: [{ assignedToId: session!.user.id }, { assignedTo: { managerId: session!.user.id } }, { assignedTo: { manager: { managerId: session!.user.id } } }] })
      else andClauses.push({ OR: [{ assignedToId: session!.user.id }, { assignedTo: { managerId: session!.user.id } }] })
    } else {
      andClauses.push({ assignedToId: session?.user.id })
    }
    const where = andClauses.length > 0 ? { AND: andClauses } : {}
    ;[singleTotal, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({ where, include: includeOpts, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ])
  }

  const displayTotal = splitView ? myTotal + teamTotal + otherTotal : singleTotal

  // Enrich dup leads with sibling info for tooltip/subtext
  const allPageLeads = splitView ? [...myLeads, ...teamLeads, ...otherLeads] : leads
  const dupPhones = [...new Set(allPageLeads.filter((l) => l.isDuplicate && l.phone).map((l) => l.phone!))]
  const dupSiblings = dupPhones.length > 0
    ? await db.lead.findMany({
        where: { phone: { in: dupPhones }, isDuplicate: false },
        select: { phone: true, campaignName: true, createdAt: true, status: true },
      })
    : []
  const siblingByPhone = Object.fromEntries(dupSiblings.map((s) => [s.phone!, s]))
  const enrichLeads = (arr: LeadRow[]) => arr.map((l) => ({
    ...l,
    dupSibling: l.isDuplicate && l.phone ? (siblingByPhone[l.phone] ?? null) : null,
  }))
  if (splitView) {
    myLeads = enrichLeads(myLeads)
    teamLeads = enrichLeads(teamLeads)
    otherLeads = enrichLeads(otherLeads)
  } else {
    leads = enrichLeads(leads)
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{displayTotal} leads total</p>
        </div>
      </div>

      <LeadsFilters isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} salespeople={salespeople} sources={sources.map(s => s.campaignName!)} />

      {splitView ? (
        <div className="space-y-7">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              My Leads
              <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{myTotal} leads</span>
            </h2>
            <LeadsTable leads={myLeads} showAssignedTo={false} />
            <Pagination page={myPage} totalPages={Math.ceil(myTotal / PAGE_SIZE)} pageParam="myPage" basePath="/leads" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Team Leads
              <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{teamTotal} leads</span>
            </h2>
            <LeadsTable leads={teamLeads} showAssignedTo={true} />
            <Pagination page={teamPage} totalPages={Math.ceil(teamTotal / PAGE_SIZE)} pageParam="teamPage" basePath="/leads" />
          </div>

          {isSuperAdmin && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                All Other Leads
                <span className="ml-2 text-xs font-medium text-gray-400 normal-case tracking-normal">{otherTotal} leads</span>
              </h2>
              <LeadsTable leads={otherLeads} showAssignedTo={true} />
              <Pagination page={otherPage} totalPages={Math.ceil(otherTotal / PAGE_SIZE)} pageParam="otherPage" basePath="/leads" />
            </div>
          )}
        </div>
      ) : (
        <>
          <LeadsTable leads={leads} showAssignedTo={isAdmin} />
          <Pagination page={page} totalPages={Math.ceil(singleTotal / PAGE_SIZE)} pageParam="page" basePath="/leads" />
        </>
      )}
    </div>
  )
}
