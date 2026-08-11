"use client"

import { useEnableNotifications } from "@/lib/useEnableNotifications"

export default function EnableNotifications() {
  const { status, enable, disable } = useEnableNotifications()

  if (status === "unsupported") return null

  if (status === "granted") {
    return (
      <button
        onClick={disable}
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition ring-1 ring-emerald-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        Notifications on · Turn off
      </button>
    )
  }

  if (status === "denied") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-400 px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        Notifications blocked in browser settings
      </span>
    )
  }

  return (
    <button
      onClick={enable}
      disabled={status === "loading"}
      className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 px-3 py-2 rounded-xl transition border border-gray-200 shadow-sm disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {status === "loading" ? "Enabling…" : "Enable notifications"}
    </button>
  )
}
