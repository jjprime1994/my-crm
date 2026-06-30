"use client"

import { useState } from "react"

type ViolationSummary = {
  totalViolations: number
  affectedSalespeople: number
  bySalesperson: { name: string; coveredStates: string[]; count: number; states: string[] }[]
}

export default function StateViolationsButton() {
  const [checking, setChecking] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [summary, setSummary] = useState<ViolationSummary | null>(null)
  const [released, setReleased] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setChecking(true)
    setError(null)
    setSummary(null)
    setReleased(null)
    try {
      const res = await fetch("/api/admin/state-violations")
      if (!res.ok) throw new Error("Failed to fetch")
      setSummary(await res.json())
    } catch {
      setError("Failed to check violations")
    } finally {
      setChecking(false)
    }
  }

  async function release() {
    if (!summary || summary.totalViolations === 0) return
    setReleasing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/state-violations", { method: "POST" })
      if (!res.ok) throw new Error("Failed to release")
      const data = await res.json()
      setReleased(data.unassigned)
      setSummary(null)
    } catch {
      setError("Failed to release leads")
    } finally {
      setReleasing(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Release Wrong-State Leads</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Finds leads claimed by salespeople whose team does not cover that lead&apos;s state, and returns them to the available pool.
        </p>
      </div>

      {released !== null && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          {released === 0 ? "No violations found — all leads are correctly assigned." : `${released} lead${released !== 1 ? "s" : ""} returned to the available pool.`}
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</div>
      )}

      {summary && summary.totalViolations === 0 && (
        <div className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          No violations found — all leads are correctly assigned.
        </div>
      )}

      {summary && summary.totalViolations > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
            Found <span className="font-semibold">{summary.totalViolations} lead{summary.totalViolations !== 1 ? "s" : ""}</span> claimed by the wrong state team across {summary.affectedSalespeople} salesperson{summary.affectedSalespeople !== 1 ? "s" : ""}.
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {summary.bySalesperson.map((sp, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-900">{sp.name}</span>
                  <span className="text-gray-400 ml-2">covers {sp.coveredStates.join(", ")}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-rose-600">{sp.count} wrong lead{sp.count !== 1 ? "s" : ""}</span>
                  <span className="text-gray-400 ml-1">({sp.states.join(", ")})</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={release}
            disabled={releasing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
          >
            {releasing ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            )}
            {releasing ? "Releasing…" : `Release ${summary.totalViolations} lead${summary.totalViolations !== 1 ? "s" : ""} back to pool`}
          </button>
        </div>
      )}

      {released === null && summary === null && (
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition"
        >
          {checking ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          )}
          {checking ? "Scanning…" : "Scan for violations"}
        </button>
      )}

      {(summary !== null || released !== null) && (
        <button onClick={() => { setSummary(null); setReleased(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-600 transition">
          Reset
        </button>
      )}
    </div>
  )
}
