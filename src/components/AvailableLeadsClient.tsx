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
  createdAt: Date | string
}

interface Props {
  leads: Lead[]
  claimLimit: number
  recentClaims: number
  resetAt: string | null
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

export default function AvailableLeadsClient({ leads: initial, claimLimit, recentClaims: initialClaims, resetAt }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initial)
  const [recentClaims, setRecentClaims] = useState(initialClaims)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState("")
  const secondsLeft = useCountdown(recentClaims >= claimLimit ? resetAt : null)

  const remaining = Math.max(0, claimLimit - recentClaims)
  const atLimit = remaining === 0 && secondsLeft > 0
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  async function claim(leadId: string) {
    if (atLimit) return
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
    setLeads(leads.filter((l) => l.id !== leadId))
    setRecentClaims((n) => n + 1)
    router.refresh()
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
        <div className={`rounded-2xl px-5 py-4 border min-w-[180px] ${atLimit ? "bg-rose-50 border-rose-200" : "bg-white border-gray-100 shadow-sm"}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Claims this window</p>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              atLimit ? "bg-rose-100 text-rose-600" : remaining <= 1 ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
            }`}>
              {atLimit ? "Limit reached" : `${remaining} left`}
            </span>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className={`text-2xl font-bold ${atLimit ? "text-rose-600" : "text-gray-900"}`}>{recentClaims}</span>
            <span className="text-sm text-gray-400 mb-0.5">/ {claimLimit}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? "bg-rose-500" : remaining <= 1 ? "bg-orange-400" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {atLimit && secondsLeft > 0 && (
            <p className="text-xs text-rose-500 mt-1.5 font-medium">Resets in {mins}m {secs}s</p>
          )}
        </div>
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
            Claim limit of <strong>{claimLimit}</strong> reached. Resets in <strong>{mins}m {secs}s</strong>.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Received</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-16">
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
              <tr key={lead.id} className={`transition ${claiming === lead.id ? "bg-blue-50/50" : "hover:bg-gray-50/70"}`}>
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
                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[140px] truncate">
                  {lead.adName ?? lead.campaignName ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => claim(lead.id)}
                    disabled={atLimit || claiming === lead.id}
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition ${
                      atLimit
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    } disabled:opacity-60`}
                  >
                    {claiming === lead.id ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Claiming…
                      </span>
                    ) : "Claim"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
