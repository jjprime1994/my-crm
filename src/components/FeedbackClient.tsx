"use client"

import { useState } from "react"

type Suggestion = {
  id: string
  type: string
  title: string
  description: string
  status: string
  createdAt: string | Date
  userId: string
  user: { name: string }
}

interface Props {
  initialSuggestions: Suggestion[]
  isAdmin: boolean
  currentUserId: string
}

const TYPE_STYLES: Record<string, string> = {
  SUGGESTION: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  BUG: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  DISMISSED: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
}

export default function FeedbackClient({ initialSuggestions, isAdmin, currentUserId }: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [type, setType] = useState<"SUGGESTION" | "BUG">("SUGGESTION")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, description }),
    })
    if (res.ok) {
      const item = await res.json()
      setSuggestions([item, ...suggestions])
      setTitle("")
      setDescription("")
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    }
    setSubmitting(false)
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setSuggestions(suggestions.map(s => s.id === id ? { ...s, status } : s))
    }
  }

  const mySuggestions = isAdmin ? [] : suggestions
  const allSuggestions = isAdmin ? suggestions : []

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">Report a bug or suggest a new feature</p>
      </div>

      {/* Submission form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Submit Feedback</h2>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(["SUGGESTION", "BUG"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                type === t
                  ? t === "BUG"
                    ? "bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200"
                    : "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {t === "BUG" ? "🐛 Bug Report" : "💡 Suggestion"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "BUG" ? "What went wrong?" : "What would you like to see?"}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder={
                type === "BUG"
                  ? "Describe what happened, what you expected, and how to reproduce it…"
                  : "Describe your idea in detail. What problem does it solve?"
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 focus:bg-white transition"
            />
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Submitted! We'll review it soon.
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !title.trim() || !description.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>

      {/* Admin: all submissions */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              All Submissions
              <span className="ml-2 text-gray-300 font-medium normal-case tracking-normal">{allSuggestions.length}</span>
            </h2>
          </div>
          {allSuggestions.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No submissions yet.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {allSuggestions.map(s => (
                <li key={s.id} className="px-6 py-4 hover:bg-gray-50/60 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_STYLES[s.type] ?? TYPE_STYLES.SUGGESTION}`}>
                          {s.type === "BUG" ? "Bug" : "Suggestion"}
                        </span>
                        <span className="text-xs font-medium text-gray-700">{s.title}</span>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{s.description}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {s.user.name} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <select
                      value={s.status}
                      onChange={e => updateStatus(s.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="DISMISSED">Dismissed</option>
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Regular users: own submissions */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Your Submissions</h2>
          </div>
          {mySuggestions.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">You haven't submitted anything yet.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {mySuggestions.map(s => (
                <li key={s.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_STYLES[s.type] ?? TYPE_STYLES.SUGGESTION}`}>
                          {s.type === "BUG" ? "Bug" : "Suggestion"}
                        </span>
                        <span className="text-xs font-medium text-gray-700">{s.title}</span>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[s.status] ?? STATUS_STYLES.OPEN}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
