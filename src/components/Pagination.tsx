"use client"

import { useSearchParams, useRouter } from "next/navigation"

function pageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = [1]
  if (current > 3) pages.push("...")
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}

export default function Pagination({
  page,
  totalPages,
  pageParam = "page",
}: {
  page: number
  totalPages: number
  pageParam?: string
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  if (totalPages <= 1) return null

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete(pageParam)
    else params.set(pageParam, String(p))
    router.push(`/leads?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-3 pb-1">
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-gray-100"
      >
        ← Prev
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-gray-400 text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p as number)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
              p === page ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-gray-100"
      >
        Next →
      </button>
    </div>
  )
}
