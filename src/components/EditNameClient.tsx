"use client"

import { useState } from "react"

function initials(name: string) {
  const parts = name.trim().split(" ")
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
}

interface Props {
  initialName: string
  email: string
  roleLabel: string
}

export default function EditNameClient({ initialName, email, roleLabel }: Props) {
  const [displayName, setDisplayName] = useState(initialName)
  const [editValue, setEditValue] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    if (!editValue.trim()) { setError("Name cannot be empty."); return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editValue.trim() }),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to update name."); return }
    setDisplayName(editValue.trim())
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-blue-600">{initials(displayName)}</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{displayName}</p>
          <p className="text-sm text-gray-400">{email}</p>
          <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
        </div>
      </div>

      {!editing ? (
        <button
          onClick={() => { setEditing(true); setEditValue(displayName) }}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit name
        </button>
      ) : (
        <div className="space-y-3">
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Display Name</label>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setError("") }}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
