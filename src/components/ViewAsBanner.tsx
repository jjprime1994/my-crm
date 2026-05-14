"use client"

import { setViewAs } from "@/app/actions/viewas"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Manager",
  TEAM_LEADER: "Team Leader",
  SALESPERSON: "Salesperson",
}

export default function ViewAsBanner({ viewAs }: { viewAs: string }) {
  return (
    <div className="bg-violet-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm shrink-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        <span className="truncate">
          Previewing as <strong>{ROLE_LABELS[viewAs]}</strong>
          <span className="hidden sm:inline"> — navigation and pages reflect this role</span>
        </span>
      </div>
      <form action={setViewAs}>
        <button
          type="submit"
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
        >
          Exit preview
        </button>
      </form>
    </div>
  )
}
