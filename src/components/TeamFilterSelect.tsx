"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

interface Props {
  teams: { id: string; name: string }[]
}

export default function TeamFilterSelect({ teams }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = new Set((searchParams.get("teams") ?? "").split(",").filter(Boolean))

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set("teams", Array.from(next).join(","))
    else params.delete("teams")
    router.push(`?${params.toString()}`)
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("teams")
    router.push(`?${params.toString()}`)
  }

  const label = selected.size === 0 ? "All teams" : `${selected.size} team${selected.size !== 1 ? "s" : ""}`

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-semibold text-gray-500">Filter by team</span>
          {selected.size > 0 && (
            <button onClick={clear} className="text-xs text-violet-600 hover:text-violet-700 font-medium">
              Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5">
          {teams.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              <Checkbox
                checked={selected.has(t.id)}
                onCheckedChange={(checked) => toggle(t.id, checked === true)}
              />
              <span className="truncate">{t.name}&apos;s Team</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
