"use client"

import { useState, useEffect, useCallback } from "react"

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
  branches: string[]
  managers: { id: string; name: string }[]
  counts: Record<string, number>
}

export default function ExportClient({ sources, branches, managers, counts }: Props) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [adName, setAdName] = useState("")
  const [platform, setPlatform] = useState("")
  const [branch, setBranch] = useState("")
  const [assigned, setAssigned] = useState("")
  const [excludeDuplicates, setExcludeDuplicates] = useState(false)
  const [managerId, setManagerId] = useState("")
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  function toggleStatus(value: string) {
    const next = new Set(selectedStatuses)
    next.has(value) ? next.delete(value) : next.add(value)
    setSelectedStatuses(next)
  }

  const buildUrl = useCallback((type: "export" | "count" = "export") => {
    const params = new URLSearchParams()
    selectedStatuses.forEach((s) => params.append("status", s))
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (adName) params.set("adName", adName)
    if (platform) params.set("platform", platform)
    if (branch) params.set("branch", branch)
    if (assigned) params.set("assigned", assigned)
    if (excludeDuplicates) params.set("excludeDuplicates", "true")
    if (managerId) params.set("managerId", managerId)
    const base = type === "count" ? "/api/export/leads/count" : "/api/export/leads"
    return `${base}?${params.toString()}`
  }, [selectedStatuses, dateFrom, dateTo, adName, platform, branch, assigned, excludeDuplicates, managerId])

  useEffect(() => {
    setCountLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(buildUrl("count"))
        const data = await res.json()
        setLiveCount(data.count ?? 0)
      } catch {
        setLiveCount(null)
      } finally {
        setCountLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [buildUrl])

  function download() {
    setDownloading(true)
    const a = document.createElement("a")
    a.href = buildUrl("export")
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => setDownloading(false), 1500)
  }

  function ChipGroup<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { value: T; label: string; activeClass?: string }[]
    value: T
    onChange: (v: T) => void
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              value === o.value
                ? o.activeClass ?? "bg-gray-100 text-gray-800 border-gray-300"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Super Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Export Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">Filter and download leads as CSV for analysis or retargeting</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">

        {/* Status */}
        <div className="p-6 space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">Status</label>
            <p className="text-xs text-gray-400 mt-0.5">Leave all unchecked to include every status. Counts shown are database totals.</p>
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

        {/* Platform */}
        <div className="p-6 space-y-3">
          <label className="text-sm font-semibold text-gray-700">Platform</label>
          <ChipGroup
            value={platform as "" | "META" | "TIKTOK" | "WEBSITE"}
            onChange={setPlatform}
            options={[
              { value: "", label: "All platforms" },
              { value: "META", label: "Meta", activeClass: "bg-blue-50 text-blue-700 border-blue-200" },
              { value: "TIKTOK", label: "TikTok", activeClass: "bg-pink-50 text-pink-700 border-pink-200" },
              { value: "WEBSITE", label: "Website", activeClass: "bg-green-50 text-green-700 border-green-200" },
            ]}
          />
        </div>

        {/* Ad source */}
        {sources.length > 0 && (
          <div className="p-6 space-y-3">
            <label className="text-sm font-semibold text-gray-700">Ad / Source</label>
            <select
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
            >
              <option value="">All ads</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* State */}
        {branches.length > 0 && (
          <div className="p-6 space-y-3">
            <label className="text-sm font-semibold text-gray-700">State</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
            >
              <option value="">All states</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}

        {/* Assignment */}
        <div className="p-6 space-y-3">
          <label className="text-sm font-semibold text-gray-700">Assignment</label>
          <ChipGroup
            value={assigned as "" | "true" | "false"}
            onChange={setAssigned}
            options={[
              { value: "", label: "All leads" },
              { value: "true", label: "Assigned only", activeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { value: "false", label: "Unassigned only", activeClass: "bg-amber-50 text-amber-700 border-amber-200" },
            ]}
          />
        </div>

        {/* Team */}
        {managers.length > 0 && (
          <div className="p-6 space-y-3">
            <div>
              <label className="text-sm font-semibold text-gray-700">Team</label>
              <p className="text-xs text-gray-400 mt-0.5">Export only leads assigned to a specific team</p>
            </div>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 focus:bg-white transition"
            >
              <option value="">All teams</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Exclude duplicates */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Exclude duplicates</p>
              <p className="text-xs text-gray-400 mt-0.5">Remove leads flagged as duplicate before exporting</p>
            </div>
            <button
              onClick={() => setExcludeDuplicates(!excludeDuplicates)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${excludeDuplicates ? "bg-violet-600" : "bg-gray-200"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${excludeDuplicates ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </div>

        {/* Download */}
        <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">Matching leads:</p>
              {countLoading ? (
                <svg className="animate-spin text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <span className="text-sm font-bold text-gray-900">{liveCount?.toLocaleString() ?? "—"}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Columns: Name · Email · Phone · Status · Ad · Campaign · State · Platform · Assigned To · Duplicate · Follow-up · Created · Updated
            </p>
          </div>
          <button
            onClick={download}
            disabled={downloading || countLoading || liveCount === 0}
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
            <span><strong>Lost leads</strong> — Re-target with a discount or different offer. Filter by status Lost, exclude duplicates, then upload phones to Meta or TikTok as a Custom Audience.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>All emails</strong> — Upload to Meta Ads as a Custom Audience → create a Lookalike Audience for better prospecting. Export Meta platform only for Meta; TikTok platform only for TikTok.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>Uncontacted (New + Unassigned)</strong> — Export unassigned leads for a manager to manually review and bulk-assign before they go cold.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>State-specific campaign</strong> — Filter by State to run a targeted regional promotion without touching leads from other areas.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
