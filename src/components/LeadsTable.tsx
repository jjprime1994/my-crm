"use client"

import { useRouter } from "next/navigation"
import { LeadStatus } from "@/generated/prisma/client"
import { calcResponseTime } from "@/lib/responseTime"

export type LeadRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  status: LeadStatus
  isDuplicate: boolean
  source?: string | null
  campaignName?: string | null
  adName?: string | null
  branch?: string | null
  claimedAt?: Date | null
  firstContactedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  assignedTo?: { id: string; name: string } | null
  _count: { notes: number }
  dupSibling?: { campaignName?: string | null; createdAt: Date | string; status: string } | null
}

function SourceBadge({ source }: { source?: string | null }) {
  if (source === "TIKTOK") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 ring-1 ring-pink-200">TikTok</span>
  if (source === "META") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 ring-1 ring-blue-200">Meta</span>
  return null
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Proposal", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
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
  NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-rose-500",
}

const WA_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
)

const CALL_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.15a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

export default function LeadsTable({ leads, showAssignedTo }: { leads: LeadRow[]; showAssignedTo: boolean }) {
  const router = useRouter()

  const empty = (
    <div className="flex flex-col items-center gap-2 text-sm text-gray-400 py-12">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      No leads found.
    </div>
  )

  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">{empty}</div>
        ) : leads.map((lead) => {
          const days = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86400000)
          const stale = lead.status !== "CLOSED_WON" && lead.status !== "CLOSED_LOST" && days >= 2
          return (
            <div
              key={lead.id}
              onClick={() => router.push(`/leads/${lead.id}`)}
              onAuxClick={(e) => { if (e.button === 1) window.open(`/leads/${lead.id}`, "_blank") }}
              className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">{(lead.firstName?.[0] ?? "?").toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{lead.firstName} {lead.lastName}</span>
                      {lead.isDuplicate && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">DUP</span>}
                      {lead.isDuplicate && <SourceBadge source={lead.source} />}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{lead.email ?? lead.phone ?? "—"}</p>
                    {lead.isDuplicate && lead.dupSibling && (
                      <p className="text-[10px] text-amber-600 mt-0.5 truncate">
                        Orig: {lead.dupSibling.campaignName ?? "Unknown"} · {new Date(lead.dupSibling.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
                      {STATUS_LABELS[lead.status]}
                    </span>
                    {stale && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${days >= 7 ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-600"}`}>{days}d ago</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {showAssignedTo && (
                    <span className="text-xs text-gray-500 truncate max-w-[100px]">
                      {lead.assignedTo ? lead.assignedTo.name : <span className="text-gray-300">Unassigned</span>}
                    </span>
                  )}
                  {(lead.campaignName ?? lead.adName) && (
                    <span className="text-xs text-gray-400 truncate max-w-[120px]">{lead.campaignName ?? lead.adName}</span>
                  )}
                  {lead.branch && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 shrink-0">{lead.branch}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {lead.phone && (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "60")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition ring-1 ring-emerald-200"
                        title="WhatsApp"
                      >
                        {WA_ICON}
                      </a>
                    )}
                    <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
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
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              {showAssignedTo && (
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</th>
              )}
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Claimed</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr><td colSpan={showAssignedTo ? 9 : 8}>{empty}</td></tr>
            )}
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => router.push(`/leads/${lead.id}`)}
                onAuxClick={(e) => { if (e.button === 1) window.open(`/leads/${lead.id}`, "_blank") }}
                className="hover:bg-gray-50/70 transition cursor-pointer"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{(lead.firstName?.[0] ?? "?").toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{lead.firstName} {lead.lastName}</span>
                      {lead.isDuplicate && (
                        <span className="relative group/dup cursor-default">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ring-1 ring-amber-200">DUP</span>
                          {lead.dupSibling && (
                            <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/dup:block bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-20 shadow-lg">
                              Orig: {lead.dupSibling.campaignName ?? "Unknown"} · {new Date(lead.dupSibling.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {STATUS_LABELS[lead.dupSibling.status as LeadStatus] ?? lead.dupSibling.status}
                            </span>
                          )}
                        </span>
                      )}
                      {lead.isDuplicate && <SourceBadge source={lead.source} />}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm">
                  <div className="text-gray-700">{lead.email ?? "—"}</div>
                  {lead.phone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-gray-400 text-xs">{lead.phone}</span>
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "60")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition ring-1 ring-emerald-200"
                        title="WhatsApp"
                      >
                        {WA_ICON}
                      </a>
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition ring-1 ring-blue-200"
                        title="Call"
                      >
                        {CALL_ICON}
                      </a>
                    </div>
                  )}
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
                    {(() => {
                      const rt = calcResponseTime(lead.claimedAt, lead.firstContactedAt)
                      if (rt) return (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${rt.colorClass}`}>
                          ⏱ {rt.label}
                        </span>
                      )
                      if (lead.claimedAt && !lead.firstContactedAt) return (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded w-fit bg-gray-100 text-gray-400">
                          Not contacted
                        </span>
                      )
                      return null
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
                  {lead.branch
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200">{lead.branch}</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
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
                  {lead.claimedAt ? (
                    <div>
                      <div>{new Date(lead.claimedAt).toLocaleDateString("en-MY", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-gray-300">{new Date(lead.claimedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
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
    </>
  )
}
