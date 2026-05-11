import { auth } from "@/auth"
import { db } from "@/lib/db"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  PROPOSAL: "bg-orange-100 text-orange-700",
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
}

function daysAgo(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function FollowUpsPage() {
  const session = await auth()
  const isAdmin = session?.user.role === "ADMIN"

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
    updatedAt: { lt: twoDaysAgo },
  }

  if (!isAdmin) where.assignedToId = session?.user.id

  const leads = await db.lead.findMany({
    where,
    include: { assignedTo: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-1">Leads not updated in 2+ days</p>
        </div>
        <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
          {leads.length} need attention
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waiting</th>
              {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                  No follow-ups needed right now.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const days = daysAgo(lead.updatedAt)
              const urgent = days >= 5
              return (
                <tr key={lead.id} className={urgent ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-blue-600 hover:underline">
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{lead.email ?? "—"}</div>
                    <div className="text-gray-400">{lead.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${urgent ? "text-red-600" : "text-orange-500"}`}>
                      {days}d ago
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.assignedTo?.name ?? <span className="text-gray-300">Unassigned</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {lead.phone && (
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded-lg transition"
                        >
                          WhatsApp
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-lg transition"
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
