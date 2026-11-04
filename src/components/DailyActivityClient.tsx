"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"

export type DailyRow = {
  userId: string
  name: string
  role: string
  teamId: string | null
  team: string | null
  leads: number | null
  appointments: number | null
  monthLeads: number
  monthAppointments: number
}

interface Props {
  date: string
  today: string
  meId: string
  rows: DailyRow[]
  showTeams: boolean
}

const NO_TEAM = "__none"
const teamKey = (r: { teamId: string | null }) => r.teamId ?? NO_TEAM

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Manager",
  TEAM_LEADER: "Team Leader",
  SALESPERSON: "Salesperson",
}

function EntryRow({ row, date, isMe, onSaved }: { row: DailyRow; date: string; isMe: boolean; onSaved: (r: DailyRow) => void }) {
  const [leads, setLeads] = useState(row.leads?.toString() ?? "")
  const [appts, setAppts] = useState(row.appointments?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const dirty = leads !== (row.leads?.toString() ?? "") || appts !== (row.appointments?.toString() ?? "")

  async function save() {
    setSaving(true)
    const res = await fetch("/api/daily-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.userId, date, leadsCount: Number(leads || 0), appointmentsCount: Number(appts || 0) }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast(j.error ?? "Couldn't save.", "error")
    }
    const l = Number(leads || 0), a = Number(appts || 0)
    onSaved({
      ...row,
      leads: l,
      appointments: a,
      monthLeads: row.monthLeads - (row.leads ?? 0) + l,
      monthAppointments: row.monthAppointments - (row.appointments ?? 0) + a,
    })
    setLeads(String(l))
    setAppts(String(a))
    toast(`Saved for ${row.name}.`)
  }

  const inputCls = "w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <tr className={isMe ? "bg-blue-50/40" : ""}>
      <td className="px-4 py-2.5">
        <p className="text-sm font-medium text-gray-900">{row.name}{isMe && <span className="ml-1.5 text-xs text-blue-600">(you)</span>}</p>
        <p className="text-xs text-gray-500">{ROLE_LABEL[row.role] ?? row.role}{row.team ? ` · Team ${row.team}` : ""}</p>
      </td>
      <td className="px-3 py-2.5 text-right">
        <label className="sr-only" htmlFor={`l-${row.userId}`}>Leads for {row.name}</label>
        <input id={`l-${row.userId}`} type="number" min={0} inputMode="numeric" value={leads} placeholder="–"
          onChange={(e) => setLeads(e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <label className="sr-only" htmlFor={`a-${row.userId}`}>Appointments for {row.name}</label>
        <input id={`a-${row.userId}`} type="number" min={0} inputMode="numeric" value={appts} placeholder="–"
          onChange={(e) => setAppts(e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2.5">
        <button onClick={save} disabled={saving || !dirty}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition">
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{row.monthLeads}</td>
      <td className="px-4 py-2.5 text-right text-sm text-gray-700 tabular-nums">{row.monthAppointments}</td>
    </tr>
  )
}

export default function DailyActivityClient({ date, today, meId, rows: allRowsInitial, showTeams }: Props) {
  const [allRows, setAllRows] = useState(allRowsInitial)
  const [teamFilter, setTeamFilter] = useState("ALL")
  const router = useRouter()

  // Team summary (Super Admin): one line per team, sorted by label, "No team" last
  const teams = [...new Map(allRows.map((r) => [teamKey(r), r.team ?? "No team"])).entries()]
    .sort((a, b) => (a[0] === NO_TEAM ? 1 : b[0] === NO_TEAM ? -1 : a[1].localeCompare(b[1])))
  const teamStats = teams.map(([key, label]) => {
    const rs = allRows.filter((r) => teamKey(r) === key)
    return {
      key, label, members: rs.length,
      entered: rs.filter((r) => r.leads !== null).length,
      l: rs.reduce((s, r) => s + (r.leads ?? 0), 0),
      a: rs.reduce((s, r) => s + (r.appointments ?? 0), 0),
      ml: rs.reduce((s, r) => s + r.monthLeads, 0),
      ma: rs.reduce((s, r) => s + r.monthAppointments, 0),
    }
  })

  const rows = teamFilter === "ALL" ? allRows : allRows.filter((r) => teamKey(r) === teamFilter)
  const setRows = setAllRows
  const multi = allRows.length > 1

  const totals = rows.reduce(
    (t, r) => ({ l: t.l + (r.leads ?? 0), a: t.a + (r.appointments ?? 0), ml: t.ml + r.monthLeads, ma: t.ma + r.monthAppointments }),
    { l: 0, a: 0, ml: 0, ma: 0 }
  )
  const missing = rows.filter((r) => r.leads === null).length
  const monthName = new Date(date + "T00:00:00").toLocaleString("en-MY", { month: "long", year: "numeric" })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter how many leads you got and how many appointments you made each day.
            {multi && " You can also fill in or correct numbers for your team."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="act-date" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Date</label>
          <input id="act-date" type="date" value={date} max={today}
            onChange={(e) => e.target.value && router.push(`/daily-activity?date=${e.target.value}`)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {date !== today && (
            <button onClick={() => router.push("/daily-activity")} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Today</button>
          )}
        </div>
      </div>

      {multi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Leads (day)", totals.l],
            ["Appointments (day)", totals.a],
            [`Leads (${monthName})`, totals.ml],
            [`Appointments (${monthName})`, totals.ma],
          ].map(([label, v]) => (
            <div key={label as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      )}

      {showTeams && teams.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">By team</p>
            <p className="text-xs text-gray-500">Click a team to see its people</p>
          </div>
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5">Team</th>
                <th className="px-3 py-2.5 text-right">Entered</th>
                <th className="px-3 py-2.5 text-right">Leads</th>
                <th className="px-3 py-2.5 text-right">Appointments</th>
                <th className="px-3 py-2.5 text-right">Month leads</th>
                <th className="px-4 py-2.5 text-right">Month appts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teamStats.map((t) => (
                <tr key={t.key} onClick={() => setTeamFilter(teamFilter === t.key ? "ALL" : t.key)}
                  className={`cursor-pointer transition ${teamFilter === t.key ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                    <button type="button" className="text-left hover:text-blue-700" aria-pressed={teamFilter === t.key}>{t.label}</button>
                  </td>
                  <td className={`px-3 py-2.5 text-right text-sm tabular-nums ${t.entered < t.members ? "text-amber-700" : "text-gray-700"}`}>{t.entered}/{t.members}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-900 font-semibold">{t.l}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-900 font-semibold">{t.a}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-gray-700">{t.ml}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700">{t.ma}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTeams && teams.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="act-team" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Team</label>
          <select id="act-team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value="ALL">All teams ({allRows.length} people)</option>
            {teamStats.map((t) => <option key={t.key} value={t.key}>{t.label} ({t.members})</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Person</th>
              <th className="px-3 py-3 text-right">Leads</th>
              <th className="px-3 py-3 text-right">Appointments</th>
              <th className="px-3 py-3"><span className="sr-only">Save</span></th>
              <th className="px-3 py-3 text-right">Month leads</th>
              <th className="px-4 py-3 text-right">Month appts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <EntryRow key={`${r.userId}-${date}`} row={r} date={date} isMe={r.userId === meId}
                onSaved={(u) => setRows((prev) => prev.map((x) => (x.userId === u.userId ? u : x)))} />
            ))}
          </tbody>
        </table>
      </div>
      {multi && missing > 0 && (
        <p className="text-xs text-amber-700">{missing} of {rows.length} people haven&apos;t entered numbers for this date yet.</p>
      )}
    </div>
  )
}
