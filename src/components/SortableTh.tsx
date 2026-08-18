"use client"

interface Props {
  label: string
  sortKey: string
  currentKey: string | null
  direction: "asc" | "desc"
  onSort: (key: string) => void
  title?: string
}

export default function SortableTh({ label, sortKey, currentKey, direction, onSort, title }: Props) {
  const active = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      title={title}
      className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-600 transition whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          className={`shrink-0 transition ${active ? "text-violet-600" : "text-gray-300"} ${active && direction === "asc" ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </th>
  )
}
