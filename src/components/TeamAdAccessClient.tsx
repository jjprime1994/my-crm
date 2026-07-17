"use client"

import { useState } from "react"
import { MALAYSIA_STATES } from "@/lib/branch"

type AdEntry = { adName: string; adId: string | null; userIds: string[]; userStates: Record<string, string[]> }
type TeamMember = { id: string; name: string; role: string }

interface Props {
  ads: AdEntry[]
  teamMembers: TeamMember[]
  myCoveredStates: string[]
}

export default function TeamAdAccessClient({ ads: initial, teamMembers, myCoveredStates }: Props) {
  const [ads, setAds] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedAd, setExpandedAd] = useState<string | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  // The states a grant can be scoped to — my own team's states, or every state if my
  // team has no restriction of its own.
  const scopableStates = myCoveredStates.length > 0 ? myCoveredStates : [...MALAYSIA_STATES]

  async function grant(adName: string, adId: string | null, userId: string, states: string[]) {
    setAds((prev) => prev.map((a) => a.adName === adName
      ? { ...a, userIds: a.userIds.includes(userId) ? a.userIds : [...a.userIds, userId], userStates: { ...a.userStates, [userId]: states } }
      : a
    ))
    setSaving(`${adName}:${userId}`)
    await fetch("/api/ad-routes/individual-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, adId, userId, states }),
    })
    setSaving(null)
  }

  async function revoke(adName: string, userId: string) {
    setAds((prev) => prev.map((a) => a.adName === adName
      ? { ...a, userIds: a.userIds.filter((id) => id !== userId), userStates: Object.fromEntries(Object.entries(a.userStates).filter(([id]) => id !== userId)) }
      : a
    ))
    setSaving(`${adName}:${userId}`)
    await fetch("/api/ad-routes/individual-access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, userId }),
    })
    setSaving(null)
  }

  function toggleMember(adName: string, adId: string | null, userId: string, granted: boolean) {
    if (granted) {
      revoke(adName, userId)
    } else {
      grant(adName, adId, userId, scopableStates)
    }
  }

  function toggleState(adName: string, adId: string | null, userId: string, currentStates: string[], state: string) {
    const newStates = currentStates.includes(state)
      ? currentStates.filter((s) => s !== state)
      : [...currentStates, state]
    // A state-restricted team must keep at least one state scoped — use the ✕ on the
    // chip to revoke access entirely instead of narrowing it down to nothing.
    if (newStates.length === 0 && myCoveredStates.length > 0) return
    grant(adName, adId, userId, newStates)
  }

  if (teamMembers.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Individual Ad Access</p>
        <p className="text-sm text-gray-500 mt-0.5">
          Grant specific team members a campaign&apos;s leads outside the normal routing — e.g. a Chinese-speaking
          member handling that language&apos;s leads. Access is scoped to {myCoveredStates.length > 0 ? "your team's states" : "any state"}.
        </p>
      </div>

      {ads.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No ads configured yet.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {ads.map((ad) => {
            const grantedMembers = teamMembers.filter((m) => ad.userIds.includes(m.id))
            const isExpanded = expandedAd === ad.adName
            return (
              <div key={ad.adName} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate" title={ad.adName}>{ad.adName}</p>
                  <button
                    onClick={() => setExpandedAd(isExpanded ? null : ad.adName)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0"
                  >
                    {isExpanded ? "Done" : "+ Manage access"}
                  </button>
                </div>

                {grantedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {grantedMembers.map((m) => {
                      const allowedStates = ad.userStates[m.id] ?? []
                      const memberKey = `${ad.adName}:${m.id}`
                      const isSaving = saving === memberKey
                      return (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        >
                          <button
                            onClick={() => setExpandedMember(expandedMember === memberKey ? null : memberKey)}
                            className="hover:underline"
                          >
                            {m.name}{allowedStates.length > 0 ? ` · ${allowedStates.join(", ")}` : " · all states"}
                          </button>
                          {isSaving ? (
                            <span className="text-emerald-400 px-1">…</span>
                          ) : (
                            <button onClick={() => revoke(ad.adName, m.id)} title="Remove access" className="text-emerald-500 hover:text-rose-600">✕</button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}

                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5">
                    {teamMembers.map((m) => {
                      const active = ad.userIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMember(ad.adName, ad.adId, m.id, active)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                            active ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                )}

                {grantedMembers.map((m) => {
                  const memberKey = `${ad.adName}:${m.id}`
                  if (expandedMember !== memberKey) return null
                  const allowedStates = ad.userStates[m.id] ?? []
                  return (
                    <div key={m.id} className="space-y-1.5 pt-1">
                      <p className="text-[10px] text-gray-400">{m.name}&apos;s scoped state(s):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {scopableStates.map((state) => {
                          const active = allowedStates.includes(state)
                          return (
                            <button
                              key={state}
                              onClick={() => toggleState(ad.adName, ad.adId, m.id, allowedStates, state)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                                active ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {state}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
