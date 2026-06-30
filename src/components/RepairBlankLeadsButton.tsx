"use client"

import { useState } from "react"

type RepairResult = {
  total: number
  updated: number
  skipped: number
}

export default function RepairBlankLeadsButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RepairResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      // Step 1: fetch missing field_data from Meta Graph API and store in rawData
      const step1 = await fetch("/api/admin/backfill-field-data", { method: "POST" })
      if (!step1.ok) throw new Error("Meta API fetch failed")
      const s1 = await step1.json()
      if (s1.errors?.length) {
        const sample = s1.errors[0] as string
        if (sample.includes("Session has expired") || sample.includes("OAuthException")) {
          throw new Error("Meta token is expired — update META_PAGE_ACCESS_TOKEN in Vercel first.")
        }
      }
      // Step 2: extract contact fields from stored rawData into DB columns
      const step2 = await fetch("/api/admin/backfill-contact-fields", { method: "POST" })
      if (!step2.ok) throw new Error("Contact field extraction failed")
      setResult(await step2.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backfill failed — check META_PAGE_ACCESS_TOKEN.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Repair Blank Leads</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Fills in missing name, phone, and email on leads that arrived blank due to an expired Meta token. Uses stored rawData first, then falls back to the Meta Graph API.
        </p>
      </div>

      {result && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          {result.updated === 0
            ? "No blank leads found — all contacts already have data."
            : `Fixed ${result.updated} of ${result.total} blank lead${result.total !== 1 ? "s" : ""}. ${result.skipped} had no recoverable data.`}
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</div>
      )}

      {result === null && (
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition"
        >
          {running ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          )}
          {running ? "Repairing…" : "Repair blank leads"}
        </button>
      )}

      {result !== null && (
        <button onClick={() => setResult(null)} className="text-xs text-gray-400 hover:text-gray-600 transition">
          Run again
        </button>
      )}
    </div>
  )
}
