"use client"

import { useState } from "react"
import { setViewAs } from "@/app/actions/viewas"

const ROLES = [
  { value: "ADMIN", label: "Manager" },
  { value: "TEAM_LEADER", label: "Team Leader" },
  { value: "SALESPERSON", label: "Salesperson" },
]

export default function ViewAsSelector({ currentViewAs }: { currentViewAs: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="px-3 py-2 border-t border-slate-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-1 mb-1 group"
      >
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">Preview as role</p>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-slate-600 group-hover:text-slate-400 transition-all ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="space-y-0.5">
          {ROLES.map(({ value, label }) => {
            const isActive = currentViewAs === value
            return (
              <form key={value} action={setViewAs}>
                <input type="hidden" name="role" value={isActive ? "" : value} />
                <button
                  type="submit"
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {isActive ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  )}
                  {label}
                </button>
              </form>
            )
          })}
        </div>
      )}
    </div>
  )
}
