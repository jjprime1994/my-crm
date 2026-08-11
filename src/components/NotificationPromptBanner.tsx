"use client"

import { useEffect, useState } from "react"
import { useEnableNotifications } from "@/lib/useEnableNotifications"

const DISMISS_KEY = "notifPromptDismissedAt"
const RENAG_AFTER_MS = 3 * 24 * 60 * 60 * 1000 // re-show 3 days after a dismiss if still not enabled

export default function NotificationPromptBanner() {
  const { status, enable } = useEnableNotifications()
  const [dismissed, setDismissed] = useState(true) // default hidden until we've checked localStorage, to avoid a flash

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    setDismissed(Date.now() - dismissedAt < RENAG_AFTER_MS)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  if (status !== "default" || dismissed) return null

  return (
    <div className="flex items-center gap-3 bg-blue-50 border-b border-blue-100 px-4 py-2.5 text-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" className="shrink-0">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span className="text-blue-900 flex-1">
        Turn on notifications so you don&apos;t miss new leads, reassignments, or follow-up reminders.
      </span>
      <button
        onClick={enable}
        className="text-blue-700 font-semibold hover:text-blue-800 shrink-0 whitespace-nowrap"
      >
        Enable
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-blue-400 hover:text-blue-600 shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
