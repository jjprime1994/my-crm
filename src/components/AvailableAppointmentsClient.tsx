"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type Slot = {
  id: string
  branch: string
  startAt: Date | string
  endAt: Date | string
}

interface Props {
  slots: Slot[]
  appointmentClaimLimit: number
  recentClaims: number
  resetAt: string | null
  isUnlimited?: boolean
}

function useCountdown(resetAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (!resetAt) return
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [resetAt])
  return secondsLeft
}

function formatSlot(startAt: Date | string, endAt: Date | string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const day = start.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" })
  const startTime = start.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })
  const endTime = end.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })
  return { day, time: `${startTime} – ${endTime}` }
}

export default function AvailableAppointmentsClient({ slots: initial, appointmentClaimLimit, recentClaims: initialClaims, resetAt, isUnlimited = false }: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState(initial)
  const [recentClaims, setRecentClaims] = useState(initialClaims)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const secondsLeft = useCountdown(resetAt)

  const remaining = Math.max(0, appointmentClaimLimit - recentClaims)
  const atLimit = !isUnlimited && remaining === 0
  const hours = Math.floor(secondsLeft / 3600)
  const mins = Math.floor((secondsLeft % 3600) / 60)

  async function claim(slotId: string) {
    if (atLimit) return
    setClaiming(slotId)
    setError("")
    const res = await fetch(`/api/appointment-slots/${slotId}/claim`, { method: "POST" })
    const data = await res.json()
    setClaiming(null)
    if (!res.ok) {
      setError(data.error ?? "Failed to claim appointment.")
      if (res.status === 429) setRecentClaims(appointmentClaimLimit)
      return
    }
    setRecentClaims((n) => n + 1)
    setClaimedIds((prev) => new Set(prev).add(slotId))
    setTimeout(() => setFadingIds((prev) => new Set(prev).add(slotId)), 800)
    setTimeout(() => {
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
      setClaimedIds((prev) => { const s = new Set(prev); s.delete(slotId); return s })
      setFadingIds((prev) => { const s = new Set(prev); s.delete(slotId); return s })
      router.refresh()
    }, 1400)
  }

  const pct = appointmentClaimLimit > 0 ? Math.round((recentClaims / appointmentClaimLimit) * 100) : 0

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Available Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{slots.length} booked appointment{slots.length === 1 ? "" : "s"} waiting to be claimed</p>
        </div>

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
              <span className="text-sm text-gray-500 mb-0.5">/ {appointmentClaimLimit}</span>
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

      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>These appointments were booked directly by the customer via WhatsApp. This is a separate daily quota from your lead claim limit.</span>
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
            Appointment claim limit of <strong>{appointmentClaimLimit}</strong> reached. Resets at <strong>midnight MYT</strong> (in {hours}h {mins}m).
          </span>
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {slots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-sm text-gray-500">No available appointments right now.</div>
        ) : slots.map((slot) => {
          const { day, time } = formatSlot(slot.startAt, slot.endAt)
          return (
            <div key={slot.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 transition-all duration-500 ${fadingIds.has(slot.id) ? "opacity-0" : "opacity-100"} ${claimedIds.has(slot.id) ? "bg-emerald-50/50" : claiming === slot.id ? "bg-blue-50/50" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{day} · {time}</p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 mt-0.5 inline-block">{slot.branch}</span>
              </div>
              {claimedIds.has(slot.id) ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Claimed
                </span>
              ) : (
                <button
                  onClick={() => claim(slot.id)}
                  disabled={atLimit || claiming === slot.id}
                  className={`text-sm font-semibold px-4 py-2 rounded-lg transition min-h-[40px] shrink-0 ${
                    atLimit ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  } disabled:opacity-60`}
                >
                  {claiming === slot.id ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : "Claim"}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slots.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    No available appointments right now.
                  </div>
                </td>
              </tr>
            )}
            {slots.map((slot) => {
              const { day, time } = formatSlot(slot.startAt, slot.endAt)
              return (
                <tr key={slot.id} className={`transition-all duration-500 ${fadingIds.has(slot.id) ? "opacity-0" : "opacity-100"} ${claiming === slot.id ? "bg-blue-50/50" : claimedIds.has(slot.id) ? "bg-emerald-50/50" : "hover:bg-gray-50/70"}`}>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{day}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{time}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200">{slot.branch}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {claimedIds.has(slot.id) ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Claimed
                      </span>
                    ) : (
                      <button
                        onClick={() => claim(slot.id)}
                        disabled={atLimit || claiming === slot.id}
                        className={`text-xs font-semibold px-4 py-2 rounded-lg transition ${
                          atLimit ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        } disabled:opacity-60`}
                      >
                        {claiming === slot.id ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            Claiming…
                          </span>
                        ) : "Claim"}
                      </button>
                    )}
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
