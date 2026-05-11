import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"
import Link from "next/link"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  PROPOSAL: "bg-orange-100 text-orange-700",
  CLOSED_WON: "bg-green-100 text-green-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
}

export default async function DashboardPage() {
  const session = await auth()
  const isAdmin = session?.user.role === "ADMIN"
  const where = isAdmin ? {} : { assignedToId: session?.user.id }
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const [total, byStatus, recent, followUpCount, unassignedCount, teamStats] = await Promise.all([
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["status"], _count: true, where }),
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { assignedTo: { select: { name: true } } },
    }),
    db.lead.count({
      where: {
        ...where,
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        updatedAt: { lt: twoDaysAgo },
      },
    }),
    isAdmin ? db.lead.count({ where: { assignedToId: null } }) : Promise.resolve(0),
    isAdmin
      ? db.user.findMany({
          select: {
            id: true,
            name: true,
            _count: { select: { leads: true } },
            leads: { select: { status: true } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const wonCount = statusMap["CLOSED_WON"] ?? 0
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-sm text-gray-500">Conversion Rate</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{conversionRate}%</p>
        </div>
        <div className={`bg-white rounded-xl shadow-sm p-5 border ${followUpCount > 0 ? "border-orange-200" : "border-gray-100"}`}>
          <p className="text-sm text-gray-500">Need Follow-up</p>
          <p className={`text-3xl font-bold mt-1 ${followUpCount > 0 ? "text-orange-500" : "text-gray-900"}`}>
            {followUpCount}
          </p>
          {followUpCount > 0 && (
            <Link href="/follow-ups" className="text-xs text-orange-500 hover:underline">View all →</Link>
          )}
        </div>
        {isAdmin && (
          <div className={`bg-white rounded-xl shadow-sm p-5 border ${unassignedCount > 0 ? "border-red-200" : "border-gray-100"}`}>
            <p className="text-sm text-gray-500">Unassigned</p>
            <p className={`text-3xl font-bold mt-1 ${unassignedCount > 0 ? "text-red-500" : "text-gray-900"}`}>
              {unassignedCount}
            </p>
            {unassignedCount > 0 && (
              <Link href="/admin/assign" className="text-xs text-red-500 hover:underline">Assign now →</Link>
            )}
          </div>
        )}
      </div>

      {/* Pipeline breakdown */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.values(LeadStatus).map((status) => (
          <div key={status} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-1">{STATUS_LABELS[status]}</p>
            <p className="text-2xl font-bold text-gray-900">{statusMap[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Leads</h2>
            <Link href="/leads" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {recent.length === 0 && (
              <li className="px-6 py-8 text-center text-sm text-gray-400">No leads yet.</li>
            )}
            {recent.map((lead) => (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{lead.email ?? lead.phone ?? "—"}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Team performance (admin only) */}
        {isAdmin && teamStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Team Performance</h2>
              <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">Manage</Link>
            </div>
            <ul className="divide-y divide-gray-50">
              {teamStats.map((member) => {
                const won = member.leads.filter((l) => l.status === "CLOSED_WON").length
                const rate = member._count.leads > 0 ? Math.round((won / member._count.leads) * 100) : 0
                return (
                  <li key={member.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{member.name}</p>
                      <p className="text-xs text-gray-500">{member._count.leads} leads</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{rate}%</p>
                      <p className="text-xs text-gray-400">conversion</p>
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
