"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Note = {
  id: string
  content: string
  createdAt: string | Date
  author: { id: string; name: string }
}

type Lead = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  status: string
  adName?: string | null
  campaignName?: string | null
  formId?: string | null
  adId?: string | null
  createdAt: string | Date
  assignedTo?: { id: string; name: string; email: string } | null
  notes: Note[]
}

interface Props {
  lead: Lead
  salespeople: { id: string; name: string }[]
  currentUser: { id: string; role?: string }
}

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
]

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  PROPOSAL: "bg-orange-100 text-orange-700",
  CLOSED_WON: "bg-green-100 text-green-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
}

export default function LeadDetailClient({ lead, salespeople, currentUser }: Props) {
  const router = useRouter()
  const isAdmin = currentUser.role === "ADMIN"

  const [status, setStatus] = useState(lead.status)
  const [assignedToId, setAssignedToId] = useState(lead.assignedTo?.id ?? "")
  const [noteContent, setNoteContent] = useState("")
  const [notes, setNotes] = useState<Note[]>(lead.notes)
  const [saving, setSaving] = useState(false)
  const [postingNote, setPostingNote] = useState(false)

  async function saveChanges() {
    setSaving(true)
    const body: Record<string, unknown> = { status }
    if (isAdmin) body.assignedToId = assignedToId || null

    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    router.refresh()
  }

  async function addNote() {
    if (!noteContent.trim()) return
    setPostingNote(true)
    const res = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent }),
    })
    const note = await res.json()
    setNotes([note, ...notes])
    setNoteContent("")
    setPostingNote(false)
  }

  const changed = status !== lead.status || (isAdmin && assignedToId !== (lead.assignedTo?.id ?? ""))

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(lead.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_COLORS[status]}`}>
          {STATUS_OPTIONS.find((s) => s.value === status)?.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Contact info */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Contact Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Email</p>
                <p className="text-gray-900">{lead.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-400">Phone</p>
                <p className="text-gray-900">{lead.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-400">Ad</p>
                <p className="text-gray-900 truncate">{lead.adName ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-400">Campaign</p>
                <p className="text-gray-900 truncate">{lead.campaignName ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-400">Form ID</p>
                <p className="text-gray-900 font-mono text-xs">{lead.formId ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-400">Ad ID</p>
                <p className="text-gray-900 font-mono text-xs">{lead.adId ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Notes</h2>
            <div className="flex gap-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                onClick={addNote}
                disabled={postingNote || !noteContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 rounded-lg transition disabled:opacity-50"
              >
                {postingNote ? "…" : "Add"}
              </button>
            </div>

            <ul className="space-y-3">
              {notes.length === 0 && (
                <li className="text-sm text-gray-400 text-center py-4">No notes yet.</li>
              )}
              {notes.map((note) => (
                <li key={note.id} className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-800">{note.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {note.author.name} · {new Date(note.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Pipeline</h2>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assign To</label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {salespeople.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {changed && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
