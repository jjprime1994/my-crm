"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { PATCH_NOTES, compareVersions } from "@/lib/patch-notes"

type FollowUp = {
  id: string
  firstName?: string | null
  lastName?: string | null
  followUpAt: string
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [newAtOpen, setNewAtOpen] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const seen = localStorage.getItem("lastSeenPatchVersion")
    setLastSeen(seen)
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setFollowUps(d.followUps ?? []))
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function openBell() {
    if (!open) {
      // Snapshot which notes are new before marking read
      const newSet = new Set(
        PATCH_NOTES.filter((n) => !lastSeen || compareVersions(n.version, lastSeen) > 0).map((n) => n.version)
      )
      setNewAtOpen(newSet)
      // Mark all as read
      if (PATCH_NOTES.length > 0) {
        localStorage.setItem("lastSeenPatchVersion", PATCH_NOTES[0].version)
        setLastSeen(PATCH_NOTES[0].version)
      }
    }
    setOpen(!open)
  }

  const unreadPatch = PATCH_NOTES.filter((n) => !lastSeen || compareVersions(n.version, lastSeen) > 0).length
  const totalBadge = followUps.length + unreadPatch

  const now = new Date()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openBell}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalBadge > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden [animation:slideDown_0.15s_ease-out]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-sm">Notifications</p>
            {followUps.length > 0 && (
              <Link href="/follow-ups" onClick={() => setOpen(false)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </Link>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {/* Follow-up reminders */}
            {followUps.length > 0 && (
              <div className="px-4 pt-3 pb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Follow-ups due</p>
                <div className="space-y-1">
                  {followUps.map((lead) => {
                    const due = new Date(lead.followUpAt)
                    const overdue = due < now
                    return (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 px-2 -mx-2 hover:bg-gray-50 rounded-xl transition"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? "bg-rose-500 animate-pulse" : "bg-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className={`text-xs ${overdue ? "text-rose-500 font-medium" : "text-amber-600"}`}>
                            {overdue ? "Overdue" : "Due today"} · {due.toLocaleDateString("en-MY", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            {followUps.length > 0 && PATCH_NOTES.length > 0 && (
              <div className="border-t border-gray-100 mx-4" />
            )}

            {/* Patch notes */}
            {PATCH_NOTES.length > 0 && (
              <div className="px-4 pt-3 pb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">What's new</p>
                <div className="space-y-3">
                  {PATCH_NOTES.map((note) => (
                    <div key={note.version}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800">{note.title}</span>
                        {newAtOpen.has(note.version) && (
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide">New</span>
                        )}
                        <span className="text-[10px] text-gray-300 ml-auto shrink-0">{note.date}</span>
                      </div>
                      <ul className="space-y-0.5 pl-1">
                        {note.items.map((item, i) => (
                          <li key={i} className="text-xs text-gray-500 flex gap-2">
                            <span className="text-gray-300 shrink-0 mt-px">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {followUps.length === 0 && PATCH_NOTES.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-gray-400">All caught up!</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
