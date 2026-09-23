"use client"

import { useState } from "react"
import { MALAYSIA_STATES } from "@/lib/branch"

type Slot = {
  id: string
  branch: string
  startAt: Date | string
  endAt: Date | string
  status: string
  claimedBy?: { name: string } | null
  lead?: { firstName: string | null; lastName: string | null; phone: string | null } | null
}

interface Props {
  slots: Slot[]
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
  BOOKED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  CLAIMED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  COMPLETED: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  MISSED: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
  CANCELLED: "bg-gray-100 text-gray-400 ring-1 ring-gray-200",
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AppointmentSlotsClient({ slots: initial }: Props) {
  const [slots, setSlots] = useState(initial)
  const [branch, setBranch] = useState<string>(MALAYSIA_STATES[0])
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function createSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!startAt || !endAt) return
    setCreating(true)
    setError("")
    const res = await fetch("/api/appointment-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? "Failed to create slot.")
      return
    }
    setSlots((prev) => [data, ...prev])
    setStartAt("")
    setEndAt("")
  }

  async function cancelSlot(id: string) {
    setCancelling(id)
    setError("")
    const res = await fetch(`/api/appointment-slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    })
    const data = await res.json()
    setCancelling(null)
    if (!res.ok) {
      setError(data.error ?? "Failed to cancel slot.")
      return
    }
    setSlots((prev) => prev.map((s) => (s.id === id ? data : s)))
  }

  return (
    <div className="space-y-5 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appointment Slots</h1>
        <p className="text-sm text-gray-500 mt-0.5">Open slots are offered to leads via the WhatsApp booking bot, per branch.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={createSlot} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">State</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
          >
            {MALAYSIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</label>
          <input
            type="datetime-local"
            value={startAt}
            min={toLocalInputValue(new Date())}
            onChange={(e) => setStartAt(e.target.value)}
            required
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">End</label>
          <input
            type="datetime-local"
            value={endAt}
            min={startAt || toLocalInputValue(new Date())}
            onChange={(e) => setEndAt(e.target.value)}
            required
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 disabled:opacity-60 transition"
        >
          {creating ? "Creating…" : "Add slot"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">End</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Booked by</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Claimed by</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slots.length === 0 && (
              <tr><td colSpan={7} className="text-center py-16 text-sm text-gray-500">No appointment slots yet.</td></tr>
            )}
            {slots.map((slot) => (
              <tr key={slot.id} className="hover:bg-gray-50/70">
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200">{slot.branch}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-700">
                  {new Date(slot.startAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-700">
                  {new Date(slot.endAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", timeStyle: "short" })}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[slot.status] ?? ""}`}>{slot.status}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {slot.lead ? `${slot.lead.firstName ?? ""} ${slot.lead.lastName ?? ""}`.trim() || slot.lead.phone || "—" : "—"}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{slot.claimedBy?.name ?? "—"}</td>
                <td className="px-5 py-3.5 text-right">
                  {slot.status === "OPEN" && (
                    <button
                      onClick={() => cancelSlot(slot.id)}
                      disabled={cancelling === slot.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-60 transition"
                    >
                      {cancelling === slot.id ? "Cancelling…" : "Cancel"}
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
