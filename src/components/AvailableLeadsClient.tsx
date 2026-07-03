"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type Lead = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  adName?: string | null
  campaignName?: string | null
  branch?: string | null
  source?: string | null
  isDuplicate?: boolean | null
  claimedBefore?: boolean
  createdAt: Date | string
  dupSibling?: { campaignName?: string | null; createdAt: Date | string; status: string; assignedTo?: { name: string } | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
}

function dupReason(lead: Lead): string {
  if (lead.isDuplicate && lead.dupSibling) {
    const s = lead.dupSibling
    const status = STATUS_LABEL[s.status] ?? s.status
    const campaign = s.campaignName ?? "Unknown campaign"
    const date = new Date(s.createdAt).toLocaleDateString("en-MY", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" })
    const claimedBy = s.assignedTo?.name ? `Claimed by ${s.assignedTo.name}` : null
    return [claimedBy, campaign, date, status].filter(Boolean).join(" · ")
  }
  if (lead.claimedBefore) return "Contact was previously claimed"
  return ""
}

function SourceBadge({ source }: { source?: string | null }) {
  if (source === "TIKTOK") {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 ring-1 ring-pink-100 shrink-0">TikTok</span>
    )
  }
  if (source === "WEBSITE") {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 ring-1 ring-green-100 shrink-0">Website</span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100 shrink-0">Meta</span>
  )
}

interface Props {
  leads: Lead[]
  claimLimit: number
  recentClaims: number
  resetAt: string | null
  newLeadsCount: number
  newLeadThreshold: number
  isUnlimited?: boolean
}

function useCountdown(resetAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (!resetAt) return
    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [resetAt])
  return secondsLeft
}

export default function AvailableLeadsClient({ leads: initial, claimLimit, recentClaims: initialClaims, resetAt, newLeadsCount, newLeadThreshold, isUnlimited = false }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initial)
  const [recentClaims, setRecentClaims] = useState(initialClaims)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const secondsLeft = useCountdown(resetAt)

  const remaining = Math.max(0, claimLimit - recentClaims)
  const atLimit = !isUnlimited && remaining === 0
  const blockedByNew = !isUnlimited && newLeadThreshold > 0 && newLeadsCount >= newLeadThreshold
  const hours = Math.floor(secondsLeft / 3600)
  const mins = Math.floor((secondsLeft % 3600) / 60)
  const secs = secondsLeft % 60

  async function claim(leadId: string) {
    if (atLimit || blockedByNew) return
    setClaiming(leadId)
    setError("")
    const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" })
    const data = await res.json()
    setClaiming(null)
    if (!res.ok) {
      setError(data.error ?? "Failed to claim lead.")
      if (res.status === 429) setRecentClaims(claimLimit)
      return
    }
    setRecentClaims((n) => n + 1)
    setClaimedIds((prev) => new Set(prev).add(leadId))
    setTimeout(() => setFadingIds((prev) => new Set(prev).add(leadId)), 800)
    setTimeout(() => {
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      setClaimedIds((prev) => { const s = new Set(prev); s.delete(leadId); return s })
      setFadingIds((prev) => { const s = new Set(prev); s.delete(leadId); return s })
      router.refresh()
    }, 1400)
  }

  const pct = claimLimit > 0 ? Math.round((recentClaims / claimLimit) * 100) : 0

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Available Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} unclaimed leads waiting</p>
        </div>

        {/* Quota card */}
        {!isUnlimited && (
          <div className={`rounded-2xl px-5 py-4 border w-full sm:w-auto sm:min-w-[180px] ${atLimit ? "bg-rose-50 border-rose-200" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">Claims today</p>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                atLimit ? "bg-rose-100 text-rose-600" : remaining <= 1 ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
              }`}>
                {atLimit ? "Limit reached" : `${remaining} left`}
              </span>
            </div>
            <div className="flex items-end gap-1 mb-2">
              <span key={recentClaims} className={`text-2xl font-bold [animation:countUp_0.3s_ease-out] ${atLimit ? "text-rose-600" : "text-gray-900"}`}>{recentClaims}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ {claimLimit}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${atLimit ? "bg-rose-500" : remaining <= 1 ? "bg-orange-400" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {atLimit && (
              <p className="text-xs text-rose-500 mt-1.5 font-medium">Resets at midnight MYT ({hours}h {mins}m)</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {atLimit && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-xl px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>
            Claim limit of <strong>{claimLimit}</strong> reached. Resets at <strong>midnight MYT</strong> (in {hours}h {mins}m).
          </span>
        </div>
      )}

      {blockedByNew && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            You have <strong>{newLeadsCount} uncontacted lead{newLeadsCount > 1 ? "s" : ""}</strong> (limit: {newLeadThreshold}).
            Contact them and update their status before claiming more — go to <strong>My Leads</strong>.
          </span>
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-sm text-gray-400">No available leads right now.</div>
        ) : leads.map((lead) => {
          const days = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000)
          const label = days === 0 ? "Today" : `${days}d ago`
          const ageCls = days === 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : days <= 3 ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200"
            : days <= 7 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
          return (
            <div key={lead.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 transition-all duration-500 ${fadingIds.has(lead.id) ? "opacity-0" : "opacity-100"} ${claimedIds.has(lead.id) ? "bg-emerald-50/50" : claiming === lead.id ? "bg-blue-50/50" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 italic">Hidden until claimed</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {lead.branch && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 shrink-0">{lead.branch}</span>
                  )}
                  <SourceBadge source={lead.source} />
                  {(lead.isDuplicate || lead.claimedBefore) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 shrink-0">DUP</span>}
                  {(lead.campaignName ?? lead.adName) && (
                    <p className="text-xs text-gray-400 truncate">{lead.campaignName ?? lead.adName}</p>
                  )}
                  {(lead.isDuplicate || lead.claimedBefore) && dupReason(lead) && (
                    <p className="text-[10px] text-amber-600 truncate w-full">{dupReason(lead)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ageCls}`}>{label}</span>
                {claimedIds.has(lead.id) ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Claimed
                  </span>
                ) : (
                  <button
                    onClick={() => claim(lead.id)}
                    disabled={atLimit || blockedByNew || claiming === lead.id}
                    className={`text-sm font-semibold px-4 py-2 rounded-lg transition min-h-[40px] ${
                      atLimit || blockedByNew ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    } disabled:opacity-60`}
                  >
                    {claiming === lead.id ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : "Claim"}
                  </button>
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
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Received</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                    </svg>
                    No available leads right now.
                  </div>
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className={`transition-all duration-500 ${fadingIds.has(lead.id) ? "opacity-0" : "opacity-100"} ${claiming === lead.id ? "bg-blue-50/50" : claimedIds.has(lead.id) ? "bg-emerald-50/50" : "hover:bg-gray-50/70"}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <span className="text-sm text-gray-400 italic">Hidden until claimed</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Claim to reveal
                  </div>
                </td>
                <td className="px-5 py-3.5 max-w-[160px]">
                  <p className="text-sm text-gray-500 truncate">{lead.campaignName ?? lead.adName ?? "—"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SourceBadge source={lead.source} />
                    {(lead.isDuplicate || lead.claimedBefore) && (
                      <span className="relative group/dup cursor-default">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">DUP</span>
                        {dupReason(lead) && (
                          <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/dup:block bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-20 shadow-lg">
                            {dupReason(lead)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  {lead.branch
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200">{lead.branch}</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </td>
                <td className="px-5 py-3.5">
                  {(() => {
                    const days = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000)
                    const label = days === 0 ? "Today" : `${days}d ago`
                    const cls = days === 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : days <= 3 ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200"
                      : days <= 7 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                  })()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {claimedIds.has(lead.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Claimed
                    </span>
                  ) : (
                    <button
                      onClick={() => claim(lead.id)}
                      disabled={atLimit || blockedByNew || claiming === lead.id}
                      className={`text-xs font-semibold px-4 py-2 rounded-lg transition ${
                        atLimit || blockedByNew ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                      } disabled:opacity-60`}
                    >
                      {claiming === lead.id ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          Claiming…
                        </span>
                      ) : "Claim"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
