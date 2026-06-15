"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

interface Props {
  isAdmin: boolean
  salespeople: { id: string; name: string }[]
  sources: string[]
}

const STATUSES = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "CLOSED_WON", label: "Won" },
  { value: "CLOSED_LOST", label: "Lost" },
]

export default function LeadsFilters({ isAdmin, salespeople, sources }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeStatus = searchParams.get("status") ?? ""
  const [search, setSearch] = useState(searchParams.get("search") ?? "")

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) params.set("search", search)
      else params.delete("search")
      clearPages(params)
      router.push(`/leads?${params.toString()}`)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  function clearPages(params: URLSearchParams) {
    params.delete("page")
    params.delete("myPage")
    params.delete("teamPage")
    params.delete("otherPage")
  }

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    clearPages(params)
    router.push(`/leads?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lead name, email, phone or salesperson…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => update("status", s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeStatus === s.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Source filter */}
        {sources.length > 0 && (
          <select
            value={searchParams.get("source") ?? ""}
            onChange={(e) => update("source", e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Salesperson filter (admin only) */}
        {isAdmin && salespeople.length > 0 && (
          <select
            value={searchParams.get("assignedToId") ?? ""}
            onChange={(e) => update("assignedToId", e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            <option value="">All salespeople</option>
            <option value="unassigned">Unassigned</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {(activeStatus || searchParams.get("source") || searchParams.get("assignedToId") || search) && (
          <button
            onClick={() => { setSearch(""); router.push("/leads?") }}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium px-3 py-2 rounded-xl hover:bg-gray-100 transition"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
