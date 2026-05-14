"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EditNameClient({ currentName }: { currentName: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    if (!name.trim()) { setError("Name cannot be empty."); return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to update name."); return }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        Edit name
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          onClick={() => { setEditing(false); setName(currentName); setError("") }}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
