"use client"

import { useLayoutEffect, useState } from "react"
import TeamFilterSelect from "@/components/TeamFilterSelect"
import FunnelChart from "@/components/FunnelChart"
import AvgResponseStars from "@/components/AvgResponseStars"
import SortableTh from "@/components/SortableTh"
import { initials, roleBadge } from "@/lib/format"
import { useScrollAnchor } from "@/lib/useScrollAnchor"
import { compareRows, type TeamHeaderRow, type TeamMemberRow } from "@/components/TeamBreakdownClient"

// Qualified was removed from the active pipeline (New -> Contacted -> Appointment Made -> Won/Lost)
const STAGE_COLUMNS: { key: keyof TeamMemberRow["statusCounts"]; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "PROPOSAL", label: "Appointment Made" },
  { key: "CLOSED_WON", label: "Won" },
  { key: "CLOSED_LOST", label: "Lost" },
]

export type TeamSection = {
  id: string
  label: string
  headerRow: TeamHeaderRow | null
  members: TeamMemberRow[]
}

interface Props {
  sections: TeamSection[]
  title?: string
  description?: string
  showFunnelChart?: boolean
  showStageColumns?: boolean
}

export default function ManagerTeamBreakdownClient({ sections, title = "Team Breakdown", description, showFunnelChart = false, showStageColumns = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false)
  // Keyed by section id — sorting one team's table must not reorder every other team on
  // the page (that reads as an unrelated "jump" for teams the user isn't even looking at).
  const [sortState, setSortState] = useState<Record<string, { key: string | null; dir: "asc" | "desc" }>>({})
  const { capture, restore } = useScrollAnchor()

  // See TeamBreakdownClient for why this exists — without it, resorting a scrolled-into
  // table feels like it randomly jumps because rows shift above the current viewport.
  useLayoutEffect(() => { restore() })

  function getSort(sectionId: string) {
    return sortState[sectionId] ?? { key: null, dir: "desc" as const }
  }

  function handleSort(sectionId: string, key: string) {
    capture()
    setSortState((prev) => {
      const cur = getSort(sectionId)
      const dir = cur.key === key ? (cur.dir === "desc" ? "asc" : "desc") : "desc"
      return { ...prev, [sectionId]: { key, dir } }
    })
  }

  function toggleNeedsAttention() {
    capture()
    setNeedsAttentionOnly((v) => !v)
  }

  function handleSearch(value: string) {
    capture()
    setSearch(value)
  }

  function matchesFilters(row: TeamMemberRow): boolean {
    if (search.trim() && !row.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (needsAttentionOnly && row.stale === 0 && row.notContacted === 0) return false
    return true
  }

  function visibleAndSorted(rows: TeamMemberRow[], sectionId: string): TeamMemberRow[] {
    const { key, dir } = getSort(sectionId)
    return rows.filter(matchesFilters).sort((a, b) => compareRows(a, b, key, dir === "asc" ? 1 : -1))
  }

  const options = sections.map((s) => ({ id: s.id, name: s.label || "Direct Reports" }))
  const teamsSelected = selected.size === 0 ? sections : sections.filter((s) => selected.has(s.id))
  const filteredSections = teamsSelected
    .map((s) => ({
      ...s,
      headerRow: s.headerRow && matchesFilters(s.headerRow) ? s.headerRow : null,
      members: visibleAndSorted(s.members, s.id),
    }))
    .filter((s) => s.headerRow || s.members.length > 0)
  const memberCount = filteredSections.reduce((sum, s) => sum + s.members.length, 0)

  const funnelData = showFunnelChart
    ? (() => {
        const rows = filteredSections.flatMap((s) => [...(s.headerRow ? [s.headerRow] : []), ...s.members])
        const sum = (k: keyof TeamMemberRow["statusCounts"]) => rows.reduce((n, r) => n + r.statusCounts[k], 0)
        return {
          stages: [
            { label: "New", count: sum("NEW") },
            { label: "Contacted", count: sum("CONTACTED") },
            { label: "Appointment Made", count: sum("PROPOSAL") },
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
          <p className="text-xs text-gray-400 mt-0.5">{memberCount} salesperson{memberCount !== 1 ? "s" : ""}</p>
          {description && <p className="text-xs text-gray-400 mt-1 max-w-lg">{description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search name…"
            className="text-xs bg-gray-100 focus:bg-white focus:ring-1 focus:ring-violet-300 rounded-lg px-3 py-1.5 w-36 focus:w-44 transition-all outline-none"
          />
          <button
            onClick={toggleNeedsAttention}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              needsAttentionOnly ? "bg-rose-100 text-rose-600 ring-1 ring-rose-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Needs attention
          </button>
          {options.length > 1 && (
            <TeamFilterSelect teams={options} selected={selected} onChange={setSelected} />
          )}
        </div>
      </div>
      {funnelData && (
        <FunnelChart stages={funnelData.stages} won={funnelData.won} lost={funnelData.lost} total={funnelData.total} />
      )}
      {teamsSelected.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No teams match this filter.</div>
      ) : filteredSections.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No members match your search.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filteredSections.map(({ id, label, headerRow, members }) => {
            const count = members.length + (headerRow ? 1 : 0)
            const { key: sortKey, dir: sortDir } = getSort(id)
            const onSort = (key: string) => handleSort(id, key)
            return (
              <div key={id}>
                {label && (
                  <div className="px-6 py-2 bg-gray-50/60">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label} · {count} member{count !== 1 ? "s" : ""}</p>
                  </div>
                )}

                {/* Mobile cards */}
                <ul className="sm:hidden divide-y divide-gray-50">
                  {headerRow && (
                    <li className="px-5 py-4 bg-blue-50/30" data-row-id={headerRow.id}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-blue-800">{initials(headerRow.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{headerRow.name}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{roleBadge(headerRow.role)}</span>
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
                  {members.map((m, i) => (
                    <li key={m.id} className="px-5 py-4" data-row-id={m.id}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-blue-600">{initials(m.name)}</span>
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
                        <SortableTh label="Member" sortKey="name" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Claimed" sortKey="claimed" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Assigned" sortKey="assigned" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Total" sortKey="totalLeads" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        {showStageColumns && STAGE_COLUMNS.map((c) => (
                          <SortableTh key={c.key} label={c.label} sortKey={c.key} currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        ))}
                        {!showStageColumns && <SortableTh label="Won" sortKey="CLOSED_WON" currentKey={sortKey} direction={sortDir} onSort={onSort} />}
                        <SortableTh label="Conv." sortKey="rate" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Avg Response" sortKey="avgResponseMs" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Not Contacted" sortKey="notContacted" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                        <SortableTh label="Stale" sortKey="stale" currentKey={sortKey} direction={sortDir} onSort={onSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {headerRow && (
                        <tr className="bg-blue-50/20 hover:bg-blue-50/40 transition" data-row-id={headerRow.id}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-800">{initials(headerRow.name)}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{headerRow.name}</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{roleBadge(headerRow.role)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><span className="text-sm font-semibold text-blue-600">{headerRow.claimed}</span></td>
                          <td className="px-6 py-4"><span className="text-sm text-gray-500">{headerRow.assigned}</span></td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{headerRow.totalLeads}</td>
                          {showStageColumns && STAGE_COLUMNS.map((c) => (
                            <td key={c.key} className="px-6 py-4">
                              <span className={`text-sm ${headerRow.statusCounts[c.key] > 0 ? "font-semibold text-gray-800" : "text-gray-300"}`}>{headerRow.statusCounts[c.key]}</span>
                            </td>
                          ))}
                          {!showStageColumns && <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{headerRow.won}</td>}
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
                      {members.map((m, i) => (
                        <tr key={m.id} className="hover:bg-gray-50/70 transition" data-row-id={m.id}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-600">{initials(m.name)}</span>
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
                          {showStageColumns && STAGE_COLUMNS.map((c) => (
                            <td key={c.key} className="px-6 py-4">
                              <span className={`text-sm ${m.statusCounts[c.key] > 0 ? "font-semibold text-gray-800" : "text-gray-300"}`}>{m.statusCounts[c.key]}</span>
                            </td>
                          ))}
                          {!showStageColumns && <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{m.won}</td>}
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
      )}
    </div>
  )
}
