"use client"

import { useState } from "react"

export default function MetaTokenRefreshTool() {
  const [token, setToken] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ permanentToken: string; pageName: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function exchange() {
    if (!token.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/admin/exchange-meta-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortLivedToken: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Exchange failed")
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRunning(false)
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(result.permanentToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Refresh Meta Page Token</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Paste a short-lived token from{" "}
          <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="underline">
            Graph API Explorer
          </a>{" "}
          — this exchanges it for a permanent page access token.
        </p>
      </div>

      {!result && (
        <div className="space-y-2">
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your short-lived access token here…"
            rows={3}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button
            onClick={exchange}
            disabled={running || !token.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition"
          >
            {running ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            )}
            {running ? "Exchanging…" : "Get permanent token"}
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="bg-emerald-50 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-emerald-700">Permanent token for: {result.pageName}</p>
            <p className="text-xs text-emerald-600">This token does not expire. Copy it and paste it into Vercel → Settings → Environment Variables → META_PAGE_ACCESS_TOKEN, then redeploy.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono text-xs text-gray-600 truncate">
              {result.permanentToken.slice(0, 40)}…
            </div>
            <button
              onClick={copy}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => { setResult(null); setToken("") }} className="text-xs text-gray-400 hover:text-gray-600 transition">
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
