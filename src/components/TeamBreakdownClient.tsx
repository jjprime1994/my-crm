"use client"

import { useEffect, useState } from "react"
import TeamFilterSelect from "@/components/TeamFilterSelect"
import FunnelChart from "@/components/FunnelChart"
import AvgResponseStars from "@/components/AvgResponseStars"
import SortableTh from "@/components/SortableTh"
import { initials, roleBadge } from "@/lib/format"
import type { LeadStatus } from "@/generated/prisma/client"

// Qualified was removed from the active pipeline (New -> Contacted -> Appointment Made -> Won/Lost)
const STAGES: LeadStatus[] = ["NEW", "CONTACTED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"]
const STAGE_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Appointment Made", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
}

export type TeamMemberRow = {
  id: string
  name: string
  claimed: number
  assigned: number
  totalLeads: number
  won: number
  rate: number
  avgResponseMs: number | null
  notContacted: number
  stale: number
  statusCounts: Record<LeadStatus, number>
}

export type TeamHeaderRow = TeamMemberRow & { role: string }

export type TeamBreakdownGroup = {
  managerId: string
  managerName: string
  managerRow: TeamHeaderRow | null
  directMembers: TeamMemberRow[]
  subTeams: {
    leaderId: string
    leaderName: string
    leaderRow: TeamHeaderRow | null
    members: TeamMemberRow[]
  }[]
}

interface Props {
  groups: TeamBreakdownGroup[]
  rangeQueryParams: string
  title?: string
  description?: string
  showExport?: boolean
  showFunnelChart?: boolean
}

// Every row (manager, team leader, member) that counts toward a group's numbers —
// used both for the member count and to aggregate stage totals across a filter.
function rowsOf(group: TeamBreakdownGroup): TeamMemberRow[] {
  return [
    ...(group.managerRow ? [group.managerRow] : []),
    ...group.directMembers,
    ...group.subTeams.flatMap((st) => [...(st.leaderRow ? [st.leaderRow] : []), ...st.members]),
  ]
}

// Sorts within each team's member list — never across teams, so the grouping stays intact.
// No key selected falls back to the original default (most won, then most leads).
// Exported for ManagerTeamBreakdownClient, which needs identical sort behavior.
export function compareRows(a: TeamMemberRow, b: TeamMemberRow, key: string | null, dir: 1 | -1): number {
  if (!key) return b.won - a.won || b.totalLeads - a.totalLeads
  if (key === "name") return dir * a.name.localeCompare(b.name)
  if (key === "avgResponseMs") {
    if (a.avgResponseMs === null && b.avgResponseMs === null) return 0
    if (a.avgResponseMs === null) return 1
    if (b.avgResponseMs === null) return -1
    return dir * (a.avgResponseMs - b.avgResponseMs)
  }
  const pick = (r: TeamMemberRow) =>
    key === "claimed" ? r.claimed
    : key === "assigned" ? r.assigned
    : key === "totalLeads" ? r.totalLeads
    : key === "rate" ? r.rate
    : key === "notContacted" ? r.notContacted
    : key === "stale" ? r.stale
    : r.statusCounts[key as LeadStatus] ?? 0
  return dir * (pick(a) - pick(b))
}

export default function TeamBreakdownClient({ groups, rangeQueryParams, title = "Team Breakdown", description, showExport = true, showFunnelChart = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function matchesFilters(row: TeamMemberRow): boolean {
    if (search.trim() && !row.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (needsAttentionOnly && row.stale === 0 && row.notContacted === 0) return false
    return true
  }

  function visibleAndSorted(rows: TeamMemberRow[]): TeamMemberRow[] {
    return rows.filter(matchesFilters).sort((a, b) => compareRows(a, b, sortKey, sortDir === "asc" ? 1 : -1))
  }

  // Pick up a `teams` filter from a shared/bookmarked link on first mount,
  // without making the server component re-fetch on every checkbox click.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("teams")
    if (param) setSelected(new Set(param.split(",").filter(Boolean)))
  }, [])

  function updateSelected(next: Set<string>) {
    setSelected(next)
    const params = new URLSearchParams(window.location.search)
    if (next.size > 0) params.set("teams", Array.from(next).join(","))
    else params.delete("teams")
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const teamOptions = groups.map((g) => ({ id: g.managerId, name: g.managerName }))
  const filteredGroups = selected.size === 0 ? groups : groups.filter((g) => selected.has(g.managerId))
  const memberCount = filteredGroups.reduce((sum, g) =>
    sum + g.directMembers.length + g.subTeams.reduce((s, st) => s + st.members.length, 0), 0)

  const exportHref = selected.size === 0
    ? `/api/export/team-report${rangeQueryParams}`
    : `/api/export/team-report${rangeQueryParams}${rangeQueryParams ? "&" : "?"}teams=${Array.from(selected).join(",")}`

  const funnelStages = showFunnelChart
    ? (() => {
        const rows = filteredGroups.flatMap(rowsOf)
        const sum = (s: LeadStatus) => rows.reduce((n, r) => n + r.statusCounts[s], 0)
        return {
          stages: [
            { label: STAGE_LABELS.NEW, count: sum("NEW") },
            { label: STAGE_LABELS.CONTACTED, count: sum("CONTACTED") },
            { label: STAGE_LABELS.PROPOSAL, count: sum("PROPOSAL") },
          ],
          won: sum("CLOSED_WON"),
          lost: sum("CLOSED_LOST"),
          total: rows.reduce((n, r) => n + r.totalLeads, 0),
        }
      })()
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {memberCount} salesperson{memberCount !== 1 ? "s" : ""} across {filteredGroups.length} team{filteredGroups.length !== 1 ? "s" : ""}
          </p>
          {description && <p className="text-xs text-gray-400 mt-1 max-w-lg">{description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name…"
            className="text-xs bg-gray-100 focus:bg-white focus:ring-1 focus:ring-violet-300 rounded-lg px-3 py-1.5 w-36 focus:w-44 transition-all outline-none"
          />
          <button
            onClick={() => setNeedsAttentionOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              needsAttentionOnly ? "bg-rose-100 text-rose-600 ring-1 ring-rose-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Needs attention
          </button>
          <TeamFilterSelect teams={teamOptions} selected={selected} onChange={updateSelected} />
          {showExport && (
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </a>
          )}
        </div>
      </div>
      {funnelStages && (
        <FunnelChart stages={funnelStages.stages} won={funnelStages.won} lost={funnelStages.lost} total={funnelStages.total} />
      )}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No teams match this filter.</div>
      ) : !filteredGroups.some((g) => rowsOf(g).some(matchesFilters)) ? (
        <div className="text-center py-12 text-sm text-gray-400">No members match your search.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredGroups.map(({ managerId, managerName, managerRow, directMembers, subTeams }) => {
            const hasManagerLeads = managerRow && managerRow.totalLeads > 0
            const totalInTeam = directMembers.length + subTeams.reduce((s, t) => s + t.members.length, 0)
            const rawSubGroups = [
              ...(hasManagerLeads || directMembers.length > 0 ? [{
                label: subTeams.length > 0 ? "Direct Reports" : "",
                headerRow: hasManagerLeads ? managerRow! : null,
                group: directMembers,
              }] : []),
              ...subTeams.map((st) => ({
                label: `${st.leaderName}'s Team`,
                headerRow: st.leaderRow && st.leaderRow.totalLeads > 0 ? st.leaderRow : null,
                group: st.members,
              })),
            ]
            const subGroups = rawSubGroups
              .map((sg) => ({
                label: sg.label,
                headerRow: sg.headerRow && matchesFilters(sg.headerRow) ? sg.headerRow : null,
                group: visibleAndSorted(sg.group),
              }))
              .filter((sg) => sg.headerRow || sg.group.length > 0)
            if (subGroups.length === 0) return null
            return (
              <div key={managerId}>
                {/* Top-level manager header */}
                <div className="px-6 py-3 bg-violet-50/50 border-b border-violet-100/60 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-700">{initials(managerName)}</span>
                  </div>
                  <span className="text-sm font-bold text-violet-800">{managerName}&apos;s Team</span>
                  <span className="text-xs text-violet-400">· {totalInTeam} member{totalInTeam !== 1 ? "s" : ""}</span>
                </div>

                {/* Sub-groups */}
                <div className="divide-y divide-gray-50">
                  {subGroups.map(({ label, headerRow, group }) => {
                    const count = group.length + (headerRow ? 1 : 0)
                    return (
                    <div key={label || "direct"}>
                      {label && (
                        <div className="px-6 py-2 bg-gray-50/60">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label} · {count} member{count !== 1 ? "s" : ""}</p>
                        </div>
                      )}

                      {/* Mobile cards */}
                      <ul className="sm:hidden divide-y divide-gray-50">
                        {headerRow && (
                          <li className="px-5 py-4 bg-violet-50/30">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-violet-800">{initials(headerRow.name)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{headerRow.name}</p>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{roleBadge(headerRow.role)}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                                  <span>{headerRow.claimed} claimed</span>
                                  <span>{headerRow.assigned} assigned</span>
                                  <span className="text-emerald-600 font-semibold">{headerRow.won} won</span>
                                  <span className={`font-bold ${headerRow.rate >= 20 ? "text-emerald-600" : headerRow.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{headerRow.rate}%</span>
                                  <AvgResponseStars avgResponseMs={headerRow.avgResponseMs} />
                                  {headerRow.notContacted > 0 && <span className="text-rose-500 font-medium">{headerRow.notContacted} not contacted</span>}
                                  {headerRow.stale > 0 && <span className="text-rose-500 font-medium">{headerRow.stale} stale</span>}
                                </div>
                              </div>
                            </div>
                          </li>
                        )}
                        {group.map((m, i) => (
                          <li key={m.id} className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-violet-600">{initials(m.name)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                                  {i === 0 && m.won > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Top</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                                  <span>{m.claimed} claimed</span>
                                  <span>{m.assigned} assigned</span>
                                  <span className="text-emerald-600 font-semibold">{m.won} won</span>
                                  <span className={`font-bold ${m.rate >= 20 ? "text-emerald-600" : m.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{m.rate}%</span>
                                  <AvgResponseStars avgResponseMs={m.avgResponseMs} />
                                  {m.notContacted > 0 && <span className="text-rose-500 font-medium">{m.notContacted} not contacted</span>}
                                  {m.stale > 0 && <span className="text-rose-500 font-medium">{m.stale} stale</span>}
                                </div>
                              </div>
                              <div className="shrink-0 w-16">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  {m.totalLeads > 0 && <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.rate}%` }} />}
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-gray-50 bg-gray-50/20">
                              <SortableTh label="Member" sortKey="name" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Claimed" sortKey="claimed" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Assigned" sortKey="assigned" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Total" sortKey="totalLeads" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              {STAGES.map((s) => (
                                <SortableTh key={s} label={STAGE_LABELS[s]} sortKey={s} currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              ))}
                              <SortableTh label="Conv." sortKey="rate" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Avg Response" sortKey="avgResponseMs" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Not Contacted" sortKey="notContacted" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                              <SortableTh label="Stale" sortKey="stale" currentKey={sortKey} direction={sortDir} onSort={handleSort} title="Active leads that haven't been updated in more than 48 hours" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {headerRow && (
                              <tr className="bg-violet-50/20 hover:bg-violet-50/40 transition">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-bold text-violet-800">{initials(headerRow.name)}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{headerRow.name}</p>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{roleBadge(headerRow.role)}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4"><span className="text-sm font-semibold text-blue-600">{headerRow.claimed}</span></td>
                                <td className="px-6 py-4"><span className="text-sm text-gray-500">{headerRow.assigned}</span></td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{headerRow.totalLeads}</td>
                                {STAGES.map((s) => (
                                  <td key={s} className="px-6 py-4">
                                    <span className={`text-sm ${headerRow.statusCounts[s] > 0 ? "font-semibold text-gray-800" : "text-gray-300"}`}>{headerRow.statusCounts[s]}</span>
                                  </td>
                                ))}
                                <td className="px-6 py-4">
                                  <span className={`text-sm font-bold ${headerRow.rate >= 20 ? "text-emerald-600" : headerRow.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{headerRow.rate}%</span>
                                </td>
                                <td className="px-6 py-4">
                                  <AvgResponseStars avgResponseMs={headerRow.avgResponseMs} />
                                </td>
                                <td className="px-6 py-4">
                                  {headerRow.notContacted > 0 ? (
                                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{headerRow.notContacted}</span>
                                  ) : (
                                    <span className="text-xs text-emerald-600 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {headerRow.stale > 0
                                    ? <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{headerRow.stale}</span>
                                    : <span className="text-xs text-emerald-600 font-medium">—</span>}
                                </td>
                              </tr>
                            )}
                            {group.map((m, i) => (
                              <tr key={m.id} className="hover:bg-gray-50/70 transition">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-bold text-violet-600">{initials(m.name)}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                                      {i === 0 && m.won > 0 && <p className="text-[10px] text-amber-600 font-semibold">Top performer</p>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm font-semibold text-blue-600">{m.claimed}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm text-gray-500">{m.assigned}</span>
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{m.totalLeads}</td>
                                {STAGES.map((s) => (
                                  <td key={s} className="px-6 py-4">
                                    <span className={`text-sm ${m.statusCounts[s] > 0 ? "font-semibold text-gray-800" : "text-gray-300"}`}>{m.statusCounts[s]}</span>
                                  </td>
                                ))}
                                <td className="px-6 py-4">
                                  <span className={`text-sm font-bold ${m.rate >= 20 ? "text-emerald-600" : m.rate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{m.rate}%</span>
                                </td>
                                <td className="px-6 py-4">
                                  <AvgResponseStars avgResponseMs={m.avgResponseMs} />
                                </td>
                                <td className="px-6 py-4">
                                  {m.notContacted > 0 ? (
                                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{m.notContacted}</span>
                                  ) : (
                                    <span className="text-xs text-emerald-600 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {m.stale > 0 ? (
                                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">{m.stale}</span>
                                  ) : (
                                    <span className="text-xs text-emerald-600 font-medium">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
