import { auth } from "@/auth"
import { db } from "@/lib/db"
import Link from "next/link"

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
  PROPOSAL: "Proposal",
}

function daysAgo(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function FollowUpsPage() {
  const session = await auth()
  const isAdmin = session?.user.role === "ADMIN"
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const userFilter = isAdmin ? {} : { assignedToId: session?.user.id }
  const where = {
    status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] as const },
    OR: [
      { followUpAt: { lte: new Date() } },
      { followUpAt: null, updatedAt: { lt: twoDaysAgo } },
    ],
    ...userFilter,
  }

  const leads = await db.lead.findMany({
    where,
    include: { assignedTo: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
  })

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leads not updated in 2+ days</p>
        </div>
        <span className={`text-sm font-semibold px-3.5 py-1.5 rounded-full ${
          leads.length > 0 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
        }`}>
          {leads.length} need attention
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Lead</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Waiting</th>
              {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</th>}
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    All caught up — no follow-ups needed.
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
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        urgent ? "bg-rose-100 text-rose-600" : "bg-orange-100 text-orange-600"
                      }`}>
                        {urgent && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        )}
                        {days}d overdue
                      </span>
                    )}
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
                        <span className="text-xs text-gray-300">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {lead.phone && (
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition ring-1 ring-emerald-200"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                          WhatsApp
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition ring-1 ring-blue-200"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.15a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
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
