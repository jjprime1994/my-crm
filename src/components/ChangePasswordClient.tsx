"use client"

import { useState } from "react"

export default function ChangePasswordClient() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (next.length < 8) { setError("New password must be at least 8 characters."); return }
    if (next !== confirm) { setError("New passwords do not match."); return }

    setSaving(true)
    const res = await fetch("/api/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setSaving(false)

    if (!res.ok) {
      const text = await res.text()
      setError(text || "Failed to update password.")
      return
    }

    setSuccess(true)
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Change Password</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Password updated successfully.
          </div>
        )}

        {[
          { label: "Current Password", value: current, setter: setCurrent },
          { label: "New Password", value: next, setter: setNext },
          { label: "Confirm New Password", value: confirm, setter: setConfirm },
        ].map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
            <input
              type="password"
              required
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
              placeholder="••••••••"
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 shadow-sm shadow-blue-200"
        >
          {saving ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  )
}
