"use client"

import { useState } from "react"
import { MALAYSIA_STATES } from "@/lib/branch"

type AdEntry = { adId: string | null; adName: string; teamIds: string[]; userIds: string[]; userStates: Record<string, string[]>; archived: boolean }
type Manager = { id: string; name: string; coveredStates: string[]; isDefaultTeam: boolean; teamName: string | null }
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
  const [expandedStateRoute, setExpandedStateRoute] = useState<string | null>(null)
  const [newAdName, setNewAdName] = useState("")
  const [addingAd, setAddingAd] = useState(false)
  const [removingAd, setRemovingAd] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null)
  const [teamNameDraft, setTeamNameDraft] = useState("")
  const [savingTeamName, setSavingTeamName] = useState<string | null>(null)
  const [expandedIndividualAd, setExpandedIndividualAd] = useState<string | null>(null)
  const [individualSearch, setIndividualSearch] = useState("")
  const [expandedIndividualUser, setExpandedIndividualUser] = useState<string | null>(null)

  const individualCandidates = allUsers.filter((u) => u.role === "SALESPERSON" || u.role === "TEAM_LEADER")

  function teamLabel(m: Manager) {
    return m.teamName || m.name
  }

  function startRenameTeam(m: Manager) {
    setEditingTeamName(m.id)
    setTeamNameDraft(m.teamName ?? "")
  }

  async function saveTeamName(managerId: string) {
    const teamName = teamNameDraft.trim()
    setManagers((prev) => prev.map((m) => (m.id === managerId ? { ...m, teamName: teamName || null } : m)))
    setEditingTeamName(null)
    setSavingTeamName(managerId)
    await fetch(`/api/users/${managerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName }),
    })
    setSavingTeamName(null)
  }

  async function addAdManually() {
    const name = newAdName.trim()
    if (!name) return
    if (ads.some((a) => a.adName === name)) {
      setNewAdName("")
      return
    }
    setAddingAd(true)
    await fetch("/api/ad-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName: name, adId: null, teamIds: [] }),
    })
    setAds((prev) => [...prev, { adId: null, adName: name, teamIds: [], userIds: [], userStates: {}, archived: false }])
    setNewAdName("")
    setAddingAd(false)
  }

  async function toggleArchive(adName: string, adId: string | null, currentArchived: boolean) {
    setAds((prev) => prev.map((a) => a.adName === adName ? { ...a, archived: !currentArchived } : a))
    await fetch("/api/ad-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, adId, archived: !currentArchived }),
    })
  }

  async function removeAd(adName: string) {
    setRemovingAd(adName)
    await fetch("/api/ad-routes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName }),
    })
    setAds((prev) => prev.filter((a) => a.adName !== adName))
    setRemovingAd(null)
  }

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

  async function toggleIndividual(adName: string, adId: string | null, userId: string) {
    const ad = ads.find((a) => a.adName === adName)!
    const granting = !ad.userIds.includes(userId)
    const newUserIds = granting
      ? [...ad.userIds, userId]
      : ad.userIds.filter((id) => id !== userId)
    // Removing a grant also clears any state restriction so a later re-grant starts fresh.
    const newUserStates = granting
      ? ad.userStates
      : Object.fromEntries(Object.entries(ad.userStates).filter(([id]) => id !== userId))

    setAds(ads.map((a) => a.adName === adName ? { ...a, userIds: newUserIds, userStates: newUserStates } : a))
    setSaving(adName)

    await fetch("/api/ad-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, adId, userIds: newUserIds, userStates: newUserStates }),
    })
    setSaving(null)
  }

  // Empty states array = unrestricted (all states); non-empty = scoped to just those.
  async function toggleIndividualState(adName: string, adId: string | null, userId: string, state: string) {
    const ad = ads.find((a) => a.adName === adName)!
    const current = ad.userStates[userId] ?? []
    const newStates = current.includes(state) ? current.filter((s) => s !== state) : [...current, state]
    const newUserStates = { ...ad.userStates, [userId]: newStates }

    setAds(ads.map((a) => a.adName === adName ? { ...a, userStates: newUserStates } : a))
    setSaving(adName)

    await fetch("/api/ad-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adName, adId, userStates: newUserStates }),
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
              {teamLabel(m)}
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
          <p className="text-sm text-gray-500 mt-0.5">Leads auto-assign via round-robin to the selected people for each state.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {MALAYSIA_STATES.map((state) => {
            const assignedIds = stateRouteMap[state] ?? []
            const assignedUsers = allUsers.filter((u) => assignedIds.includes(u.id))
            const isExpanded = expandedStateRoute === state
            const isSaving = savingStateRoute === state
            return (
              <div key={state} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 w-36 shrink-0">{state}</span>
                    {isSaving && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>
                  <button
                    onClick={() => setExpandedStateRoute(isExpanded ? null : state)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0"
                  >
                    {isExpanded ? "Done" : assignedIds.length === 0 ? "Assign" : `${assignedIds.length} person${assignedIds.length !== 1 ? "s" : ""}`}
                  </button>
                </div>

                {assignedUsers.length > 0 && !isExpanded && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {assignedUsers.map((u) => (
                      <span key={u.id} className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">{u.name}</span>
                    ))}
                  </div>
                )}

                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {allUsers.map((u) => {
                      const active = assignedIds.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleStateUser(state, u.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                            active
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {u.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Team States */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Teams</p>
          <p className="text-sm text-gray-500 mt-0.5">Name each team and set which states it covers. Leave states empty for a team that should cover all states (e.g. a language-specific team).</p>
        </div>
        <div className="divide-y divide-gray-50">
          {managers.map((m) => (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {editingTeamName === m.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={teamNameDraft}
                        onChange={(e) => setTeamNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTeamName(m.id)
                          if (e.key === "Escape") setEditingTeamName(null)
                        }}
                        placeholder={m.name}
                        className="text-sm font-medium border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                      />
                      <button onClick={() => saveTeamName(m.id)} className="text-xs text-blue-600 font-semibold hover:text-blue-800">Save</button>
                      <button onClick={() => setEditingTeamName(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-sm text-gray-900 truncate">{teamLabel(m)}</span>
                      {m.teamName && <span className="text-xs text-gray-400 shrink-0">({m.name})</span>}
                      <button
                        onClick={() => startRenameTeam(m)}
                        title="Rename team"
                        className="shrink-0 text-gray-300 hover:text-blue-500 transition"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {m.isDefaultTeam && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-200 shrink-0">Default</span>
                  )}
                  {(savingStates === m.id || savingTeamName === m.id) && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
                </div>
                <button
                  onClick={() => setExpandedStates(expandedStates === m.id ? null : m.id)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0"
                >
                  {expandedStates === m.id ? "Done" : m.coveredStates.length === 0 ? "All states" : `${m.coveredStates.length} state${m.coveredStates.length !== 1 ? "s" : ""}`}
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
        <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Ad → Team Assignment</p>
            <p className="text-sm text-gray-500 mt-0.5">Pre-configure routing before a campaign goes live. Use &quot;Individual access&quot; to grant specific salespeople an ad&apos;s leads outside their team&apos;s normal routing (e.g. a language-specific campaign) — click a granted person&apos;s name to restrict it to their own state(s) instead of all states.</p>
          </div>
        </div>

        {/* Manual add */}
        <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ad or campaign name…"
            value={newAdName}
            onChange={(e) => setNewAdName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAdManually()}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addAdManually}
            disabled={!newAdName.trim() || addingAd}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {addingAd ? "Adding…" : "Add"}
          </button>
        </div>

        {(() => {
          const activeAds = ads.filter((a) => !a.archived)
          const archivedAds = ads.filter((a) => a.archived)

          function AdRow({ ad }: { ad: AdEntry }) {
            return (
              <div key={ad.adName} className={`px-5 py-4 space-y-2 ${ad.archived ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate" title={ad.adName}>{ad.adName}</p>
                  {saving === ad.adName && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
                  {!ad.archived && ad.teamIds.length === 0 && saving !== ad.adName && (
                    <span className="text-xs text-amber-600 font-medium shrink-0">→ Default team</span>
                  )}
                  <button
                    onClick={() => toggleArchive(ad.adName, ad.adId, ad.archived)}
                    title={ad.archived ? "Unarchive" : "Archive this ad"}
                    className="shrink-0 text-gray-300 hover:text-amber-500 transition"
                  >
                    {ad.archived ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 21 12 21 4 21"/><path d="M4 21V9l8-7 8 7v12"/><line x1="9" y1="21" x2="9" y2="12"/><line x1="15" y1="21" x2="15" y2="12"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                      </svg>
                    )}
                  </button>
                  {!ad.archived && (
                    <button
                      onClick={() => removeAd(ad.adName)}
                      disabled={removingAd === ad.adName}
                      title="Delete permanently"
                      className="shrink-0 text-gray-300 hover:text-rose-500 transition disabled:opacity-40"
                    >
                      {removingAd === ad.adName ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                {!ad.archived && (
                  <div className="flex flex-wrap gap-2">
                    {managers.map((m) => {
                      const active = ad.teamIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleTeam(ad.adName, ad.adId, m.id)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition ${
                            active ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {teamLabel(m)}
                        </button>
                      )
                    })}
                  </div>
                )}
                {!ad.archived && (() => {
                  const grantedUsers = individualCandidates.filter((u) => ad.userIds.includes(u.id))
                  const isExpanded = expandedIndividualAd === ad.adName
                  return (
                    <div className="pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Individual access:</span>
                        {grantedUsers.map((u) => {
                          const allowedStates = ad.userStates[u.id] ?? []
                          const userKey = `${ad.adName}:${u.id}`
                          return (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            >
                              <button
                                onClick={() => setExpandedIndividualUser(expandedIndividualUser === userKey ? null : userKey)}
                                title="Click to restrict by state"
                                className="hover:underline"
                              >
                                {u.name}{allowedStates.length > 0 ? ` · ${allowedStates.join(", ")}` : " · all states"}
                              </button>
                              <button
                                onClick={() => toggleIndividual(ad.adName, ad.adId, u.id)}
                                title="Remove access"
                                className="text-emerald-500 hover:text-rose-600"
                              >
                                ✕
                              </button>
                            </span>
                          )
                        })}
                        <button
                          onClick={() => {
                            setExpandedIndividualAd(isExpanded ? null : ad.adName)
                            setIndividualSearch("")
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >
                          {isExpanded ? "Done" : "+ Add person"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search salespeople…"
                            value={individualSearch}
                            onChange={(e) => setIndividualSearch(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                            {individualCandidates
                              .filter((u) => u.name.toLowerCase().includes(individualSearch.toLowerCase()))
                              .map((u) => {
                                const active = ad.userIds.includes(u.id)
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => toggleIndividual(ad.adName, ad.adId, u.id)}
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                                      active ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {u.name}
                                  </button>
                                )
                              })}
                          </div>
                        </div>
                      )}
                      {grantedUsers.map((u) => {
                        const userKey = `${ad.adName}:${u.id}`
                        if (expandedIndividualUser !== userKey) return null
                        const allowedStates = ad.userStates[u.id] ?? []
                        return (
                          <div key={u.id} className="mt-2 space-y-1.5">
                            <p className="text-[10px] text-gray-400">
                              {u.name}&apos;s access — leave empty for all states, or pick specific state(s) to restrict to just those:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {MALAYSIA_STATES.map((state) => {
                                const active = allowedStates.includes(state)
                                return (
                                  <button
                                    key={state}
                                    onClick={() => toggleIndividualState(ad.adName, ad.adId, u.id, state)}
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
                })()}
              </div>
            )
          }

          return (
            <>
              {activeAds.length === 0 && archivedAds.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No ads yet — add one above or wait for leads to come in.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activeAds.map((ad) => <AdRow key={ad.adName} ad={ad} />)}
                </div>
              )}
              {archivedAds.length > 0 && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-2.5 bg-gray-50/60">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Archived ({archivedAds.length})</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {archivedAds.map((ad) => <AdRow key={ad.adName} ad={ad} />)}
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
