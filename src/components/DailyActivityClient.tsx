"use client"

import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"
import { APPOINTMENT_SOURCES, SOURCE_DETAIL, sourceLabel, type DailyAppointmentRow } from "@/lib/commission"

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
  appts: DailyAppointmentRow[]
}

type MonthSource = { userId: string; source: string; count: number }

interface Props {
  date: string
  today: string
  meId: string
  rows: DailyRow[]
  showTeams: boolean
  monthSources: MonthSource[]
}

const NO_TEAM = "__none"
const teamKey = (r: { teamId: string | null }) => r.teamId ?? NO_TEAM

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Manager",
  TEAM_LEADER: "Team Leader",
  SALESPERSON: "Salesperson",
}

const inputCls = "text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"

function AppointmentsPanel({ row, date, onAdded, onDeleted }: {
  row: DailyRow
  date: string
  onAdded: (a: DailyAppointmentRow) => void
  onDeleted: (a: DailyAppointmentRow) => void
}) {
  const [source, setSource] = useState("")
  const [other, setOther] = useState("")
  const [customer, setCustomer] = useState("")
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const detail = SOURCE_DETAIL[source]
  const canAdd = !!source && (!detail || other.trim() !== "")

  async function add() {
    setBusy(true)
    const res = await fetch("/api/daily-activity/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.userId, date, source, sourceOther: other, customerName: customer }),
    })
    setBusy(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return toast(j.error ?? "Couldn't add appointment.", "error")
    onAdded(j.appointment)
    setSource(""); setOther(""); setCustomer("")
    toast(`Appointment added for ${row.name}.`)
  }

  async function remove(a: DailyAppointmentRow) {
    if (!confirm(`Delete this appointment (${sourceLabel(a)}${a.customerName ? ` – ${a.customerName}` : ""})?`)) return
    const res = await fetch(`/api/daily-activity/appointments/${a.id}`, { method: "DELETE" })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast(j.error ?? "Couldn't delete.", "error")
    }
    onDeleted(a)
  }

  const id = (k: string) => `${k}-${row.userId}`

  return (
    <div className="space-y-3">
      {row.appts.length === 0 ? (
        <p className="text-xs text-gray-500">No appointments entered for this day yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {row.appts.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 text-sm bg-white border border-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400 tabular-nums w-5">{i + 1}.</span>
              <span className="font-medium text-gray-900">{sourceLabel(a)}</span>
              {a.customerName && <span className="text-gray-500 truncate">· {a.customerName}</span>}
              <button onClick={() => remove(a)} className="ml-auto text-xs text-red-600 hover:text-red-700">Delete</button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={id("src")} className="block text-xs font-medium text-gray-600 mb-1">Lead source <span className="text-red-600">*</span></label>
          <select id={id("src")} value={source} onChange={(e) => setSource(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Select…</option>
            {APPOINTMENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {detail && (
          <div>
            <label htmlFor={id("oth")} className="block text-xs font-medium text-gray-600 mb-1">{detail.label} <span className="text-red-600">*</span></label>
            <input id={id("oth")} value={other} onChange={(e) => setOther(e.target.value)} placeholder={detail.placeholder} className={`${inputCls} w-44`} />
          </div>
        )}
        <div>
          <label htmlFor={id("cus")} className="block text-xs font-medium text-gray-600 mb-1">Customer (optional)</label>
          <input id={id("cus")} value={customer} onChange={(e) => setCustomer(e.target.value)} className={`${inputCls} w-48`} />
        </div>
        <button onClick={add} disabled={busy || !canAdd}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition">
          {busy ? "Adding…" : "+ Add appointment"}
        </button>
      </div>
    </div>
  )
}

function EntryRow({ row, date, isMe, onChange }: {
  row: DailyRow
  date: string
  isMe: boolean
  onChange: (r: DailyRow, apptDelta?: { source: string; delta: 1 | -1 }) => void
}) {
  const [leads, setLeads] = useState(row.leads?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const toast = useToast()
  const dirty = leads !== (row.leads?.toString() ?? "")

  async function save() {
    setSaving(true)
    const res = await fetch("/api/daily-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.userId, date, leadsCount: Number(leads || 0) }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast(j.error ?? "Couldn't save.", "error")
    }
    const l = Number(leads || 0)
    onChange({ ...row, leads: l, monthLeads: row.monthLeads - (row.leads ?? 0) + l })
    setLeads(String(l))
    toast(`Saved for ${row.name}.`)
  }

  const n = row.appts.length

  return (
    <Fragment>
      <tr className={isMe ? "bg-blue-50/40" : ""}>
        <td className="px-4 py-2.5">
          <p className="text-sm font-medium text-gray-900">{row.name}{isMe && <span className="ml-1.5 text-xs text-blue-600">(you)</span>}</p>
          <p className="text-xs text-gray-500">{ROLE_LABEL[row.role] ?? row.role}{row.team ? ` · Team ${row.team}` : ""}</p>
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <label className="sr-only" htmlFor={`l-${row.userId}`}>Leads for {row.name}</label>
            <input id={`l-${row.userId}`} type="number" min={0} inputMode="numeric" value={leads} placeholder="–"
              onChange={(e) => setLeads(e.target.value)} className={`${inputCls} w-20 text-right`} />
            <button onClick={save} disabled={saving || !dirty}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right">
          <button onClick={() => setOpen(!open)} aria-expanded={open}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${open ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {n > 0 ? `${n} appointment${n !== 1 ? "s" : ""}` : "+ Add"} {open ? "▴" : "▾"}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{row.monthLeads}</td>
        <td className="px-4 py-2.5 text-right text-sm text-gray-700 tabular-nums">{row.monthAppointments}</td>
      </tr>
      {open && (
        <tr className="bg-gray-50/70">
          <td colSpan={5} className="px-4 py-3">
            <AppointmentsPanel row={row} date={date}
              onAdded={(a) => { if (row.leads === null) setLeads("0"); onChange(
                { ...row, appts: [...row.appts, a], appointments: n + 1, leads: row.leads ?? 0, monthAppointments: row.monthAppointments + 1 },
                { source: a.source, delta: 1 }) }}
              onDeleted={(a) => onChange(
                { ...row, appts: row.appts.filter((x) => x.id !== a.id), appointments: n - 1, monthAppointments: row.monthAppointments - 1 },
                { source: a.source, delta: -1 })} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export default function DailyActivityClient({ date, today, meId, rows: allRowsInitial, showTeams, monthSources: monthSourcesInitial }: Props) {
  const [allRows, setAllRows] = useState(allRowsInitial)
  const [monthSources, setMonthSources] = useState(monthSourcesInitial)
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
      a: rs.reduce((s, r) => s + r.appts.length, 0),
      ml: rs.reduce((s, r) => s + r.monthLeads, 0),
      ma: rs.reduce((s, r) => s + r.monthAppointments, 0),
    }
  })

  const rows = teamFilter === "ALL" ? allRows : allRows.filter((r) => teamKey(r) === teamFilter)
  const multi = allRows.length > 1

  const totals = rows.reduce(
    (t, r) => ({ l: t.l + (r.leads ?? 0), a: t.a + r.appts.length, ml: t.ml + r.monthLeads, ma: t.ma + r.monthAppointments }),
    { l: 0, a: 0, ml: 0, ma: 0 }
  )
  const missing = rows.filter((r) => r.leads === null).length
  const monthName = new Date(date + "T00:00:00").toLocaleString("en-MY", { month: "long", year: "numeric" })

  // Appointments by lead source for the people currently shown (day + month)
  const shownIds = new Set(rows.map((r) => r.userId))
  const daySrc = new Map<string, number>()
  for (const r of rows) for (const a of r.appts) daySrc.set(a.source, (daySrc.get(a.source) ?? 0) + 1)
  const monthSrc = new Map<string, number>()
  for (const m of monthSources) if (shownIds.has(m.userId)) monthSrc.set(m.source, (monthSrc.get(m.source) ?? 0) + m.count)
  const sourceStats = APPOINTMENT_SOURCES.map((s) => ({ s, day: daySrc.get(s) ?? 0, month: monthSrc.get(s) ?? 0 }))
  const anySource = sourceStats.some((x) => x.month > 0 || x.day > 0)

  function handleChange(u: DailyRow, apptDelta?: { source: string; delta: 1 | -1 }) {
    setAllRows((prev) => prev.map((x) => (x.userId === u.userId ? u : x)))
    if (apptDelta) {
      setMonthSources((prev) => {
        const hit = prev.find((m) => m.userId === u.userId && m.source === apptDelta.source)
        if (!hit) return [...prev, { userId: u.userId, source: apptDelta.source, count: apptDelta.delta }]
        return prev.map((m) => (m === hit ? { ...m, count: m.count + apptDelta.delta } : m))
      })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter how many leads you got, and add each appointment you made with its lead source.
            {multi && " You can also fill in or correct entries for your team."}
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

      {multi && anySource && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Appointments by lead source</p>
          </div>
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5">Source</th>
                <th className="px-3 py-2.5 text-right">Day</th>
                <th className="px-4 py-2.5 text-right">{monthName}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sourceStats.map((x) => (
                <tr key={x.s}>
                  <td className="px-4 py-2 text-sm text-gray-900">{x.s}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-gray-900">{x.day}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-700">{x.month}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <th className="px-3 py-3 text-right">Month leads</th>
              <th className="px-4 py-3 text-right">Month appts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <EntryRow key={`${r.userId}-${date}`} row={r} date={date} isMe={r.userId === meId} onChange={handleChange} />
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
