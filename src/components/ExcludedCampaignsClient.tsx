"use client"

import { useState } from "react"

type CampaignEntry = { campaignId: string; campaignName: string | null; excluded: boolean }

interface Props {
  campaigns: CampaignEntry[]
}

export default function ExcludedCampaignsClient({ campaigns: initial }: Props) {
  const [campaigns, setCampaigns] = useState(initial)
  const [toggling, setToggling] = useState<string | null>(null)
  const [newCampaignId, setNewCampaignId] = useState("")
  const [newCampaignName, setNewCampaignName] = useState("")
  const [adding, setAdding] = useState(false)

  async function setExcluded(campaignId: string, campaignName: string | null, excluded: boolean) {
    setCampaigns((prev) => prev.map((c) => (c.campaignId === campaignId ? { ...c, excluded } : c)))
    setToggling(campaignId)

    if (excluded) {
      await fetch("/api/excluded-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, campaignName }),
      })
    } else {
      await fetch("/api/excluded-campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      })
    }
    setToggling(null)
  }

  async function addManually() {
    const campaignId = newCampaignId.trim()
    if (!campaignId) return
    const campaignName = newCampaignName.trim() || null

    setAdding(true)
    await fetch("/api/excluded-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, campaignName }),
    })

    setCampaigns((prev) => {
      const existing = prev.find((c) => c.campaignId === campaignId)
      if (existing) return prev.map((c) => (c.campaignId === campaignId ? { ...c, excluded: true, campaignName: campaignName ?? c.campaignName } : c))
      return [...prev, { campaignId, campaignName, excluded: true }].sort((a, b) =>
        (a.campaignName ?? a.campaignId).localeCompare(b.campaignName ?? b.campaignId)
      )
    })
    setNewCampaignId("")
    setNewCampaignName("")
    setAdding(false)
  }

  const excludedCampaigns = campaigns.filter((c) => c.excluded)
  const flowingCampaigns = campaigns.filter((c) => !c.excluded)

  function CampaignRow({ c }: { c: CampaignEntry }) {
    const isToggling = toggling === c.campaignId
    return (
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{c.campaignName ?? "(unnamed campaign)"}</p>
          <p className="text-xs text-gray-500 truncate">{c.campaignId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isToggling && <span className="text-xs text-gray-500">Saving…</span>}
          <button
            onClick={() => setExcluded(c.campaignId, c.campaignName, !c.excluded)}
            disabled={isToggling}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition disabled:opacity-40 ${
              c.excluded
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c.excluded ? "Excluded — click to re-enable" : "Flowing to CRM"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Excluded Campaigns</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Leads from an excluded campaign are dropped at the webhook — no Lead row is created. Use this for campaigns
          currently handled directly on the business WhatsApp number, until the WhatsApp appointment system covers them.
        </p>
      </div>

      {/* Manual add */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Exclude a Campaign by ID</p>
        <p className="text-sm text-gray-500">
          Use this for a campaign that hasn&apos;t sent a lead into the CRM yet (find the Campaign ID in Meta Ads Manager or the campaign URL).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Campaign ID…"
            value={newCampaignId}
            onChange={(e) => setNewCampaignId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManually()}
            className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Label (optional)…"
            value={newCampaignName}
            onChange={(e) => setNewCampaignName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManually()}
            className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addManually}
            disabled={!newCampaignId.trim() || adding}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {adding ? "Adding…" : "Exclude"}
          </button>
        </div>
      </div>

      {/* Excluded */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Excluded ({excludedCampaigns.length})</p>
          <p className="text-sm text-gray-500 mt-0.5">Not flowing into the CRM.</p>
        </div>
        {excludedCampaigns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">No campaigns excluded — every campaign currently flows into the CRM.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {excludedCampaigns.map((c) => <CampaignRow key={c.campaignId} c={c} />)}
          </div>
        )}
      </div>

      {/* Flowing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Flowing to CRM ({flowingCampaigns.length})</p>
          <p className="text-sm text-gray-500 mt-0.5">Known campaigns (from leads already received) that still create Lead rows normally.</p>
        </div>
        {flowingCampaigns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">No campaigns yet — they&apos;ll appear here once a lead comes in.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {flowingCampaigns.map((c) => <CampaignRow key={c.campaignId} c={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
