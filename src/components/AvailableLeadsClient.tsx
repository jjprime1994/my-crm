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

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Available Leads</h1>
          <p className="text-sm text-gray-500 mt-1">{leads.length} unclaimed leads</p>
        </div>

        {/* Claim quota indicator */}
        <div className={`rounded-xl px-4 py-3 text-right border ${atLimit ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
          <p className="text-xs text-gray-500">Claims this window</p>
          <p className={`text-2xl font-bold ${atLimit ? "text-red-600" : remaining <= 1 ? "text-orange-500" : "text-gray-900"}`}>
            {recentClaims} / {claimLimit}
          </p>
          {atLimit && secondsLeft > 0 && (
            <p className="text-xs text-red-500 mt-0.5">
              Resets in {mins}m {secs}s
            </p>
          )}
          {!atLimit && (
            <p className="text-xs text-gray-400">{remaining} left (per 15 min)</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {atLimit && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-lg px-4 py-3">
          You've reached your claim limit of {claimLimit} leads per 15 minutes. Come back in {mins}m {secs}s.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm text-gray-400">
                  No available leads right now.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {lead.firstName} {lead.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <div>{lead.email ?? "—"}</div>
                  <div className="text-gray-400">{lead.phone ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">
                  {lead.adName ?? lead.campaignName ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => claim(lead.id)}
                    disabled={atLimit || claiming === lead.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                  >
                    {claiming === lead.id ? "Claiming…" : "Claim"}
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
