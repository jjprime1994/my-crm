"use client"

import { useRouter, useSearchParams } from "next/navigation"

interface Props {
  isAdmin: boolean
  salespeople: { id: string; name: string }[]
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

export default function LeadsFilters({ isAdmin, salespeople }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeStatus = searchParams.get("status") ?? ""

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/leads?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status pill tabs */}
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
    </div>
  )
}
