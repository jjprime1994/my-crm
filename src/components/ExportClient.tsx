"use client"

import { useState } from "react"

const STATUS_OPTIONS = [
  { value: "NEW", label: "New", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "CONTACTED", label: "Contacted", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "QUALIFIED", label: "Qualified", color: "text-violet-700 bg-violet-50 border-violet-200" },
  { value: "PROPOSAL", label: "Proposal", color: "text-orange-700 bg-orange-50 border-orange-200" },
  { value: "CLOSED_WON", label: "Won", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "CLOSED_LOST", label: "Lost", color: "text-rose-700 bg-rose-50 border-rose-200" },
]

interface Props {
  sources: string[]
  counts: Record<string, number>
}

export default function ExportClient({ sources, counts }: Props) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [adName, setAdName] = useState("")
  const [downloading, setDownloading] = useState(false)

  function toggleStatus(value: string) {
    const next = new Set(selectedStatuses)
    next.has(value) ? next.delete(value) : next.add(value)
    setSelectedStatuses(next)
  }

  const estimatedCount = STATUS_OPTIONS
    .filter((s) => selectedStatuses.size === 0 || selectedStatuses.has(s.value))
    .reduce((sum, s) => sum + (counts[s.value] ?? 0), 0)

  function buildUrl() {
    const params = new URLSearchParams()
    selectedStatuses.forEach((s) => params.append("status", s))
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (adName) params.set("adName", adName)
    return `/api/export/leads?${params.toString()}`
  }

  async function download() {
    setDownloading(true)
    const res = await fetch(buildUrl())
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Super Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Export Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Filter and download leads as CSV for retargeting campaigns
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {/* Status filter */}
        <div className="p-6 space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">Filter by Status</label>
            <p className="text-xs text-gray-400 mt-0.5">Leave all unchecked to export every status</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const active = selectedStatuses.has(s.value)
              return (
                <button
                  key={s.value}
                  onClick={() => toggleStatus(s.value)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    active ? s.color : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {s.label}
                  <span className="opacity-60">({counts[s.value] ?? 0})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Date range */}
        <div className="p-6 space-y-3">
          <label className="text-sm font-semibold text-gray-700">Date Range</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
              />
            </div>
            <div className="text-gray-300 mt-5">—</div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Source filter */}
        {sources.length > 0 && (
          <div className="p-6 space-y-3">
            <label className="text-sm font-semibold text-gray-700">Filter by Ad / Source</label>
            <select
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Download */}
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              Estimated export: <span className="font-semibold text-gray-900">{estimatedCount} lead{estimatedCount !== 1 ? "s" : ""}</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Columns: Name, Email, Phone, Status, Source, Campaign, Assigned To, Date</p>
          </div>
          <button
            onClick={download}
            disabled={downloading || estimatedCount === 0}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40 shadow-sm shadow-violet-200 shrink-0"
          >
            {downloading ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Downloading…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Retargeting tips */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-violet-800">Retargeting Tips</h3>
        <ul className="space-y-1.5 text-xs text-violet-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>Lost</strong> — Re-target with a discount or different offer on Facebook Ads</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>All emails</strong> — Upload to Meta Ads as a Custom Audience → create a Lookalike Audience for better targeting</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>New / Contacted</strong> — Run a reminder campaign to warm them up before calling again</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
