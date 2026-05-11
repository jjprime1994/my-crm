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

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  CONTACTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  QUALIFIED: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  PROPOSAL: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  CLOSED_WON: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CLOSED_LOST: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
}

const STATUS_DOT: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL: "bg-orange-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-500",
}

function initials(first?: string | null, last?: string | null) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "?"
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
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-blue-600">
                {initials(lead.firstName, lead.lastName)}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {lead.firstName} {lead.lastName}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                  {STATUS_OPTIONS.find((s) => s.value === status)?.label}
                </span>
                <span className="text-xs text-gray-400">
                  Added {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {lead.phone && (
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-sm shadow-emerald-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-sm shadow-blue-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.15a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Email
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact + Notes */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Contact Info</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                { label: "Email", value: lead.email },
                { label: "Phone", value: lead.phone },
                { label: "Ad", value: lead.adName },
                { label: "Campaign", value: lead.campaignName },
                { label: "Form ID", value: lead.formId, mono: true },
                { label: "Ad ID", value: lead.adId, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                  <p className={`text-gray-900 ${mono ? "font-mono text-xs" : ""} truncate`}>
                    {value ?? <span className="text-gray-300">—</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Notes</h2>
            <div className="flex gap-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote() }}
                rows={2}
                placeholder="Add a note… (Ctrl+Enter to save)"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 focus:bg-white transition"
              />
              <button
                onClick={addNote}
                disabled={postingNote || !noteContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 rounded-xl transition disabled:opacity-40 shrink-0"
              >
                {postingNote ? "…" : "Add"}
              </button>
            </div>

            <ul className="space-y-3">
              {notes.length === 0 && (
                <li className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                  No notes yet. Add one above.
                </li>
              )}
              {notes.map((note) => (
                <li key={note.id} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-blue-600">{note.author.name[0].toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {note.author.name} · {new Date(note.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Pipeline */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Pipeline</h2>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Assigned To</label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
                >
                  <option value="">Unassigned</option>
                  {salespeople.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {changed && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 shadow-sm shadow-blue-200"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}

            {/* Assigned to info */}
            {lead.assignedTo && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-2">Assigned to</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-violet-600">{lead.assignedTo.name[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.assignedTo.name}</p>
                    <p className="text-xs text-gray-400">{lead.assignedTo.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
