"use client"

import { useMemo, useState } from "react"
import { setViewAsUser } from "@/app/actions/viewas"

export type PickableUser = { id: string; name: string; role: string }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Manager",
  TEAM_LEADER: "Team Leader",
  SALESPERSON: "Salesperson",
}
const ROLE_ORDER = ["ADMIN", "TEAM_LEADER", "SALESPERSON"]

export default function ViewAsSelector({ users, currentViewAs }: { users: PickableUser[]; currentViewAs: PickableUser | null }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users
    return ROLE_ORDER.map((role) => ({
      role,
      label: ROLE_LABELS[role] ?? role,
      members: filtered.filter((u) => u.role === role).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.members.length > 0)
  }, [users, search])

  return (
    <div className="px-3 py-2 border-t border-slate-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-1 mb-1 group"
      >
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">Preview as</p>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-slate-600 group-hover:text-slate-400 transition-all ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name…"
            className="w-full bg-slate-800 text-white text-sm placeholder:text-slate-500 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="max-h-64 overflow-y-auto space-y-2">
            {grouped.length === 0 && (
              <p className="text-xs text-slate-500 px-1 py-2">No match.</p>
            )}
            {grouped.map(({ role, label, members }) => (
              <div key={role}>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-1 mb-0.5">{label}</p>
                <div className="space-y-0.5">
                  {members.map((u) => {
                    const isActive = currentViewAs?.id === u.id
                    return (
                      <form key={u.id} action={setViewAsUser}>
                        <input type="hidden" name="userId" value={isActive ? "" : u.id} />
                        <button
                          type="submit"
                          className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all truncate ${
                            isActive
                              ? "bg-violet-600 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          {isActive ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                          )}
                          <span className="truncate">{u.name}</span>
                        </button>
                      </form>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
