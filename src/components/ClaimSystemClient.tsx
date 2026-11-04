"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"

export default function ClaimSystemClient({ paused: initial }: { paused: boolean }) {
  const [paused, setPaused] = useState(initial)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const toast = useToast()

  async function toggle() {
    const next = !paused
    if (!next && !confirm("Turn lead and appointment claiming back ON for everyone?")) return
    setSaving(true)
    const res = await fetch("/api/claim-system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: next }),
    })
    setSaving(false)
    if (!res.ok) return toast("Couldn't save — try again.", "error")
    setPaused(next)
    toast(next ? "Claiming paused." : "Claiming restored.")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Claim System</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pausing hides Available Leads and Available Appointments and blocks claiming. Nothing is deleted: existing
          leads, claim history and routing rules stay as they are. Turning claiming back on restores the old flow.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Claiming is {paused ? <span className="text-rose-600">PAUSED</span> : <span className="text-emerald-600">ON</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {paused
              ? "Staff record daily numbers and commission claims instead. Incoming leads are still saved."
              : "Salespeople can claim leads and appointments as normal."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-40 ${
            paused ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {saving ? "Saving…" : paused ? "Resume claiming" : "Pause claiming"}
        </button>
      </div>
    </div>
  )
}
