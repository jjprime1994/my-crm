"use client"

import { useState } from "react"
import { MALAYSIA_STATES } from "@/lib/branch"

type AdEntry = { adId: string | null; adName: string; teamIds: string[] }
type Manager = { id: string; name: string; coveredStates: string[]; isDefaultTeam: boolean }
type UserEntry = { id: string; name: string; role: string }

interface Props {
  ads: AdEntry[]
  managers: Manager[]
  defaultTeamId: string | null
  stateRouteMap: Record<string, string[]>
  allUsers: UserEntry[]
}

export default function AdRoutingClient({ ads: initial, managers: initialManagers, defaultTeamId: initialDefault, stateRouteMap: initialStateRouteMap, allUsers }: Props) {
  const [ads, setAds] = useState(initial)
  const [managers, setManagers] = useState(initialManagers)
  const [defaultTeamId, setDefaultTeamId] = useState(initialDefault)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingDefault, setSavingDefault] = useState(false)
  const [savingStates, setSavingStates] = useState<string | null>(null)
  const [expandedStates, setExpandedStates] = useState<string | null>(null)
  const [stateRouteMap, setStateRouteMap] = useState<Record<string, string[]>>(initialStateRouteMap)
  const [savingStateRoute, setSavingStateRoute] = useState<string | null>(null)

  async function toggleTeam(adName: string, adId: string | null, managerId: string) {
    const ad = ads.find((a) => a.adName === adName)!
    const newTeamIds = ad.teamIds.includes(managerId)
      ? ad.teamIds.filter((id) => id !== managerId)
      : [...ad.teamIds, managerId]

    setAds(ads.map((a) => a.adName === adName ? { ...a, teamIds: newTeamIds } : a))
    setSaving(adName)

    await fetch("/api/ad-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, adId, teamIds: newTeamIds }),
    })
    setSaving(null)
  }

  async function changeDefault(managerId: string) {
    const newDefault = defaultTeamId === managerId ? null : managerId
    setDefaultTeamId(newDefault)
    setSavingDefault(true)
    await fetch("/api/ad-routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultTeamId: newDefault }),
    })
    setSavingDefault(false)
  }

  async function toggleStateUser(state: string, userId: string) {
    const current = stateRouteMap[state] ?? []
    const newUserIds = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]

    setStateRouteMap((prev) => ({ ...prev, [state]: newUserIds }))
    setSavingStateRoute(state)

    await fetch("/api/state-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, userIds: newUserIds }),
    })
    setSavingStateRoute(null)
  }

  async function toggleState(managerId: string, state: string) {
    const mgr = managers.find((m) => m.id === managerId)!
    const newStates = mgr.coveredStates.includes(state)
      ? mgr.coveredStates.filter((s) => s !== state)
      : [...mgr.coveredStates, state]

    setManagers(managers.map((m) => m.id === managerId ? { ...m, coveredStates: newStates } : m))
    setSavingStates(managerId)

    await fetch(`/api/users/${managerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coveredStates: newStates }),
    })
    setSavingStates(null)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ad Routing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control which team handles leads from each ad, and which states each team covers</p>
      </div>

      {/* Default Team */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Default Team</p>
          {savingDefault && <span className="text-xs text-gray-400">Saving…</span>}
        </div>
        <p className="text-sm text-gray-500">Unrouted leads (ads with no team assigned, or unrecognised state) go to this team.</p>
        <div className="flex flex-wrap gap-2">
          {managers.map((m) => (
            <button
              key={m.id}
              onClick={() => changeDefault(m.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                defaultTeamId === m.id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m.name}
            </button>
          ))}
          {defaultTeamId && (
            <button
              onClick={() => changeDefault(defaultTeamId)}
              className="px-3 py-1.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* State Routing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">State Routing</p>
          <p className="text-sm text-gray-500 mt-0.5">Leads from each state are auto-assigned via round-robin across the selected people.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {MALAYSIA_STATES.map((state) => {
            const assignedIds = stateRouteMap[state] ?? []
            const isSaving = savingStateRoute === state
            return (
              <div key={state} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 w-36 shrink-0">{state}</p>
                  {isSaving && <span className="text-xs text-gray-400">Saving…</span>}
                  {!isSaving && assignedIds.length === 0 && (
                    <span className="text-xs text-amber-600 font-medium">→ Default team</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allUsers.map((u) => {
                    const active = assignedIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleStateUser(state, u.id)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {u.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Team States */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Team Coverage (States)</p>
        </div>
        <div className="divide-y divide-gray-50">
          {managers.map((m) => (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{m.name}</span>
                  {m.isDefaultTeam && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-200">Default</span>
                  )}
                  {savingStates === m.id && <span className="text-xs text-gray-400">Saving…</span>}
                </div>
                <button
                  onClick={() => setExpandedStates(expandedStates === m.id ? null : m.id)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                >
                  {expandedStates === m.id ? "Done" : m.coveredStates.length === 0 ? "Set states" : `${m.coveredStates.length} state${m.coveredStates.length !== 1 ? "s" : ""}`}
                </button>
              </div>

              {m.coveredStates.length > 0 && expandedStates !== m.id && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.coveredStates.map((s) => (
                    <span key={s} className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">{s}</span>
                  ))}
                </div>
              )}

              {expandedStates === m.id && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {MALAYSIA_STATES.map((state) => {
                    const active = m.coveredStates.includes(state)
                    return (
                      <button
                        key={state}
                        onClick={() => toggleState(m.id, state)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {state}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ad → Team routing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Ad → Team Assignment</p>
        </div>

        {ads.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No ads found — leads will populate this list as they come in.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ads.map((ad) => (
              <div key={ad.adName} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate" title={ad.adName}>{ad.adName}</p>
                  {saving === ad.adName && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
                  {ad.teamIds.length === 0 && (
                    <span className="text-xs text-amber-600 font-medium shrink-0">→ Default team</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {managers.map((m) => {
                    const active = ad.teamIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleTeam(ad.adName, ad.adId, m.id)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
