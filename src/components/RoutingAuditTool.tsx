"use client"

import { useState } from "react"

type AuditResult = {
  ok: boolean
  violations: string[]
  checkedAt: string
  durationMs: number
}

// Runs the same invariant suite as the nightly 6am cron (pool routing,
// recent assignments, claim limits) and shows the full report inline.
export default function RoutingAuditTool() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/cron/check-routing")
      if (!res.ok) throw new Error("Failed")
      setResult(await res.json())
    } catch {
      setError("Audit failed to run — try again or check Vercel logs.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Routing Audit</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Runs the nightly health check now: available-pool routing per user, recently assigned leads held by the right teams, and daily claim limits. Read-only — nothing is changed.
        </p>
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</div>
      )}

      {result && result.ok && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          All routing invariants hold — checked in {(result.durationMs / 1000).toFixed(1)}s.
        </div>
      )}

      {result && !result.ok && (
        <div className="space-y-3">
          <div className="text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">
            Found <span className="font-semibold">{result.violations.length} violation{result.violations.length !== 1 ? "s" : ""}</span> — checked in {(result.durationMs / 1000).toFixed(1)}s.
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.violations.map((v, i) => (
              <div key={i} className="text-xs px-3 py-2 bg-gray-50 rounded-lg text-gray-700">{v}</div>
            ))}
          </div>
        </div>
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
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
          )}
          {running ? "Auditing… (can take up to a minute)" : "Run routing audit"}
        </button>
      )}

      {result !== null && (
        <button onClick={() => { setResult(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-600 transition">
          Run again
        </button>
      )}
    </div>
  )
}
