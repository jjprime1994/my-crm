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

  const [total, byStatus, recent] = await Promise.all([
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["status"], _count: true, where }),
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { assignedTo: { select: { name: true } } },
    }),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="col-span-2 md:col-span-3 lg:col-span-1 bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        {Object.values(LeadStatus).map((status) => (
          <div key={status} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <p className="text-sm text-gray-500">{STATUS_LABELS[status]}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{statusMap[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Leads</h2>
          <Link href="/leads" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <ul className="divide-y divide-gray-50">
          {recent.length === 0 && (
            <li className="px-6 py-8 text-center text-sm text-gray-400">No leads yet.</li>
          )}
          {recent.map((lead) => (
            <li key={lead.id}>
              <Link href={`/leads/${lead.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{lead.email ?? lead.phone ?? "—"}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                  {STATUS_LABELS[lead.status]}
                </span>
                {isAdmin && lead.assignedTo && (
                  <span className="text-xs text-gray-400 hidden md:block">{lead.assignedTo.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
