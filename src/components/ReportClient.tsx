"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"
import { groupByHierarchy, groupKeyOf, hierarchyIndex, roleLabel, NO_TEAM_KEY } from "@/lib/hierarchy"
import { monthLabel } from "@/lib/commission"
import { LOCATION_TYPES, REPORT_PACKAGE_SUGGESTIONS, collectionPct, type ReportKindStr, type ReportRow } from "@/lib/report"

type Person = { id: string; name: string; role: string; disabled: boolean; managerId: string | null; teamId: string | null; teamLabel: string | null }

interface Props {
  month: string
  meId: string
  canExport: boolean
  showTeams: boolean
  users: Person[]
  rows: ReportRow[]
}

type Field = { key: keyof ReportRow; label: string; type: "text" | "number" | "package" | "locationType"; required?: boolean; wide?: boolean }

// Columns follow Sales and Location Report 2026.xlsx
const SALES_FIELDS: Field[] = [
  { key: "customerName", label: "Customer", type: "text", required: true, wide: true },
  { key: "sellingPrice", label: "Selling Price (RM)", type: "number" },
  { key: "collection", label: "Collection (RM)", type: "number" },
  { key: "packageType", label: "Package Type", type: "package" },
]
const LOCATION_FIELDS: Field[] = [
  { key: "customerName", label: "Customer", type: "text", required: true },
  { key: "locationDescription", label: "Location Description", type: "text", wide: true },
  { key: "locationType", label: "Type", type: "locationType" },
]
const FIELDS: Record<ReportKindStr, Field[]> = { SALES: SALES_FIELDS, LOCATION: LOCATION_FIELDS }

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

type FormState = { id: string | null; kind: ReportKindStr; userId: string; values: Record<string, string> }

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

const sum = (rs: ReportRow[], k: "sellingPrice" | "collection") => rs.reduce((s, r) => s + (r[k] ?? 0), 0)

export default function ReportClient({ month, meId, canExport, showTeams, users, rows: initial }: Props) {
  const router = useRouter()
  const toast = useToast()

  const [rows, setRows] = useState(initial)
  const [personFilter, setPersonFilter] = useState<string>("ALL")
  const [teamFilter, setTeamFilter] = useState<string>("ALL")
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const multi = users.length > 1
  const nameOf = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  const roleOf = useMemo(() => new Map(users.map((u) => [u.id, u.role])), [users])
  // Same order as MA/LA: the viewer's own team first, then Management, teams A→Z, "No team" last.
  const hierarchy = useMemo(() => {
    const me = users.find((u) => u.id === meId)
    return groupByHierarchy(users, me ? groupKeyOf(me) : undefined)
  }, [users, meId])
  const order = useMemo(() => hierarchyIndex(hierarchy), [hierarchy])
  const byRank = (a: string, b: string) => (order.get(a)?.rank ?? Infinity) - (order.get(b)?.rank ?? Infinity)
  const teamOf = useMemo(() => new Map(users.map((u) => [u.id, groupKeyOf(u)])), [users])

  const teamStats = useMemo(
    () =>
      hierarchy.map((g) => {
        const rs = rows.filter((r) => (teamOf.get(r.userId) ?? NO_TEAM_KEY) === g.key)
        const sales = rs.filter((r) => r.kind === "SALES")
        return { key: g.key, label: g.label, sales: sales.length, selling: sum(sales, "sellingPrice"), collection: sum(sales, "collection"), locations: rs.length - sales.length }
      }),
    [hierarchy, rows, teamOf]
  )
  const visibleUsers = (teamFilter === "ALL" ? users : users.filter((u) => groupKeyOf(u) === teamFilter)).slice().sort((a, b) => byRank(a.id, b.id))
  const activeUsers = users.filter((u) => !u.disabled || u.id === meId)

  const groups = useMemo(() => {
    const map = new Map<string, ReportRow[]>()
    for (const r of rows) {
      if (personFilter !== "ALL" && r.userId !== personFilter) continue
      if (teamFilter !== "ALL" && (teamOf.get(r.userId) ?? NO_TEAM_KEY) !== teamFilter) continue
      map.set(r.userId, [...(map.get(r.userId) ?? []), r])
    }
    return [...map.entries()]
      .map(([userId, rs]) => ({ userId, name: nameOf.get(userId) ?? "Unknown", sales: rs.filter((r) => r.kind === "SALES"), locs: rs.filter((r) => r.kind === "LOCATION") }))
      .sort((a, b) => byRank(a.userId, b.userId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, personFilter, teamFilter, nameOf, teamOf, order])
  const showTeamHeaders = new Set(groups.map((g) => order.get(g.userId)?.groupKey)).size > 1

  const allSales = groups.flatMap((g) => g.sales)
  const totals = { selling: sum(allSales, "sellingPrice"), collection: sum(allSales, "collection"), sales: allSales.length, locations: groups.reduce((s, g) => s + g.locs.length, 0) }

  function openAdd(kind: ReportKindStr, userId?: string) {
    const values = Object.fromEntries(FIELDS[kind].map((f) => [f.key, ""]))
    setForm({ id: null, kind, userId: userId ?? (personFilter !== "ALL" ? personFilter : meId), values })
  }

  function openEdit(r: ReportRow) {
    const values = Object.fromEntries(FIELDS[r.kind].map((f) => [f.key, r[f.key] === null ? "" : String(r[f.key])]))
    setForm({ id: r.id, kind: r.kind, userId: r.userId, values })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    const res = await fetch(form.id ? `/api/report/${form.id}` : "/api/report", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: form.kind, month, userId: form.userId, ...form.values }),
    })
    setSaving(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return toast(j.error ?? "Couldn't save.", "error")
    const row = j as ReportRow
    setRows((prev) => (form.id ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]))
    toast(form.id ? "Row updated." : form.kind === "SALES" ? "Sale added." : "Location added.")
    setForm(null)
  }

  async function remove(r: ReportRow) {
    if (!confirm(`Delete the ${r.kind === "SALES" ? "sale" : "location"} for "${r.customerName}"?`)) return
    setDeleting(r.id)
    const res = await fetch(`/api/report/${r.id}`, { method: "DELETE" })
    setDeleting(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast(j.error ?? "Couldn't delete.", "error")
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    toast("Row deleted.")
  }

  function renderInput(f: Field) {
    if (!form) return null
    const value = form.values[f.key] ?? ""
    const set = (v: string) => setForm({ ...form, values: { ...form.values, [f.key]: v } })
    const id = `r-${f.key}`
    if (f.type === "locationType") {
      const opts = value && !(LOCATION_TYPES as readonly string[]).includes(value) ? [...LOCATION_TYPES, value] : LOCATION_TYPES
      return (
        <select id={id} value={value} onChange={(e) => set(e.target.value)} className={inputCls}>
          <option value="">— Select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <>
        <input
          id={id}
          type={f.type === "number" ? "number" : "text"}
          step={f.type === "number" ? "any" : undefined}
          min={f.type === "number" ? 0 : undefined}
          inputMode={f.type === "number" ? "decimal" : undefined}
          list={f.type === "package" ? "r-package-list" : undefined}
          placeholder={f.type === "package" ? "Pick or type" : undefined}
          required={f.required}
          value={value}
          onChange={(e) => set(e.target.value)}
          className={inputCls}
        />
        {f.type === "package" && (
          <datalist id="r-package-list">
            {REPORT_PACKAGE_SUGGESTIONS.map((o) => <option key={o} value={o} />)}
          </datalist>
        )}
      </>
    )
  }

  // Live Collection (%) preview in the Sales form
  const formPct = form?.kind === "SALES"
    ? collectionPct({ sellingPrice: form.values.sellingPrice === "" ? null : Number(form.values.sellingPrice), collection: form.values.collection === "" ? null : Number(form.values.collection) })
    : null

  const dash = <span className="text-gray-300">–</span>
  const actions = (r: ReportRow) => (
    <td className="px-3 py-2 whitespace-nowrap text-right">
      <button onClick={() => openEdit(r)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 mr-3">Edit</button>
      <button onClick={() => remove(r)} disabled={deleting === r.id} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40">
        {deleting === r.id ? "…" : "Delete"}
      </button>
    </td>
  )
  const th = "px-3 py-2 whitespace-nowrap"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales &amp; Location Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Location &amp; Sales Performance Report Details – {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.push(`/report?month=${shiftMonth(month, -1)}`)}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous month">‹</button>
          <label htmlFor="r-month" className="sr-only">Month</label>
          <input id="r-month" type="month" value={month}
            onChange={(e) => e.target.value && router.push(`/report?month=${e.target.value}`)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push(`/report?month=${shiftMonth(month, 1)}`)}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next month">›</button>
          {canExport && (
            <a href={`/api/report/export?month=${month}`} className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              Export Excel
            </a>
          )}
          <button onClick={() => openAdd("SALES")} className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">+ Add sale</button>
          <button onClick={() => openAdd("LOCATION")} className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">+ Add location</button>
        </div>
      </div>

      {/* Summary + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
          <p className="text-xs text-gray-500 font-medium">Selling price</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">RM {rm(totals.selling)}</p>
          <p className="text-xs text-gray-500">{totals.sales} sale{totals.sales === 1 ? "" : "s"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
          <p className="text-xs text-gray-500 font-medium">Collection</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">RM {rm(totals.collection)}</p>
          <p className="text-xs text-gray-500">{totals.selling > 0 ? `${Math.round((totals.collection / totals.selling) * 100)}% collected` : " "}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
          <p className="text-xs text-gray-500 font-medium">Locations</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totals.locations}</p>
          <p className="text-xs text-gray-500">{monthLabel(month)}</p>
        </div>
        {showTeams && teamStats.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="r-team" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Team</label>
            <select id="r-team" value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); setPersonFilter("ALL") }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
              <option value="ALL">All teams</option>
              {teamStats.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        )}
        {multi && (
          <div className="flex items-center gap-2">
            <label htmlFor="r-person" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Person</label>
            <select id="r-person" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
              <option value="ALL">Everyone ({visibleUsers.length})</option>
              {visibleUsers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.disabled ? " (disabled)" : ""}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* By team (Super Admin) */}
      {showTeams && teamStats.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">By team · {monthLabel(month)}</p>
            <p className="text-xs text-gray-500">Click a team to filter</p>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2">Team</th>
                <th className="px-3 py-2 text-right">Sales</th>
                <th className="px-3 py-2 text-right">Selling Price (RM)</th>
                <th className="px-3 py-2 text-right">Collection (RM)</th>
                <th className="px-5 py-2 text-right">Locations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teamStats.map((t) => (
                <tr key={t.key} onClick={() => { setTeamFilter(teamFilter === t.key ? "ALL" : t.key); setPersonFilter("ALL") }}
                  className={`cursor-pointer transition ${teamFilter === t.key ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <td className="px-5 py-2 font-medium text-gray-900">
                    <button type="button" className="text-left hover:text-blue-700" aria-pressed={teamFilter === t.key}>{t.label}</button>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{t.sales}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{rm(t.selling)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{rm(t.collection)}</td>
                  <td className="px-5 py-2 text-right tabular-nums text-gray-700">{t.locations}</td>
                </tr>
              ))}
              <tr className="bg-gray-50/60 font-semibold">
                <td className="px-5 py-2">ALL TEAMS</td>
                <td className="px-3 py-2 text-right tabular-nums">{teamStats.reduce((s, t) => s + t.sales, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rm(teamStats.reduce((s, t) => s + t.selling, 0))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rm(teamStats.reduce((s, t) => s + t.collection, 0))}</td>
                <td className="px-5 py-2 text-right tabular-nums">{teamStats.reduce((s, t) => s + t.locations, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit form */}
      {form && (
        <form onSubmit={submit} className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${form.kind === "SALES" ? "border-blue-200" : "border-indigo-200"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {form.id ? "Edit" : "New"} {form.kind === "SALES" ? "sale" : "location"} · {monthLabel(month)}
            </p>
            <button type="button" onClick={() => setForm(null)} className="text-xs text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
          {multi && (
            <div className="max-w-xs">
              <label htmlFor="r-user" className="block text-xs font-medium text-gray-600 mb-1">Report for</label>
              <select id="r-user" value={form.userId} disabled={!!form.id} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls}>
                {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === meId ? " (you)" : ""}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FIELDS[form.kind].map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <label htmlFor={`r-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}{f.required && <span className="text-rose-500"> *</span>}
                </label>
                {renderInput(f)}
              </div>
            ))}
            {form.kind === "SALES" && (
              <div>
                <p className="block text-xs font-medium text-gray-600 mb-1">Collection (%)</p>
                <p className="text-sm py-1.5 tabular-nums text-gray-700">{formPct === null ? "Auto" : `${formPct}%`}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="text-sm px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
              {saving ? "Saving…" : form.id ? "Save changes" : form.kind === "SALES" ? "Add sale" : "Add location"}
            </button>
          </div>
        </form>
      )}

      {/* One block per person: Sales table + Location table, like the template */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-500">
          No reports for {monthLabel(month)} yet. Click <span className="font-semibold">+ Add sale</span> or <span className="font-semibold">+ Add location</span>.
        </div>
      ) : (
        groups.map((g, gi) => {
          const pos = order.get(g.userId)
          const newTeam = showTeamHeaders && pos?.groupKey !== order.get(groups[gi - 1]?.userId)?.groupKey
          const depth = Math.min(pos?.depth ?? 0, 3)
          const sp = sum(g.sales, "sellingPrice")
          const col = sum(g.sales, "collection")
          return (
            <div key={g.userId} className="space-y-3">
              {newTeam && (
                <div className="rounded-xl bg-[#1F4E78] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white">Team: {pos?.groupLabel ?? "No team"}</div>
              )}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ marginLeft: `${depth * 1.25}rem` }}>
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60">
                  <p className="text-sm font-semibold text-gray-900">
                    Name: {g.name}
                    <span className="ml-2 rounded-full bg-gray-200/70 px-2 py-0.5 text-[11px] font-medium text-gray-600">{roleLabel(roleOf.get(g.userId) ?? "")}</span>
                    {g.userId === meId && <span className="ml-1.5 text-xs text-blue-600">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    {g.sales.length} sale{g.sales.length === 1 ? "" : "s"} · RM {rm(col)} collected · {g.locs.length} location{g.locs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-gray-100">
                  {/* Sales */}
                  <div className="overflow-x-auto">
                    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Sales</p>
                      <button onClick={() => openAdd("SALES", g.userId)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add</button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                          <th className={th}>No</th><th className={th}>Customer</th><th className={`${th} text-right`}>Selling Price</th>
                          <th className={`${th} text-right`}>Collection (RM)</th><th className={`${th} text-right`}>Collection (%)</th><th className={th}>Package Type</th>
                          <th className={th}><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.sales.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-xs text-gray-400">No sales this month.</td></tr>}
                        {g.sales.map((r, i) => {
                          const pct = collectionPct(r)
                          return (
                            <tr key={r.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-2 text-gray-900">{r.customerName}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.sellingPrice === null ? dash : rm(r.sellingPrice)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.collection === null ? dash : rm(r.collection)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{pct === null ? dash : `${pct}%`}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.packageType ?? dash}</td>
                              {actions(r)}
                            </tr>
                          )
                        })}
                        {g.sales.length > 0 && (
                          <tr className="bg-gray-50/60 font-semibold">
                            <td className="px-3 py-2" colSpan={2}>Total</td>
                            <td className="px-3 py-2 text-right tabular-nums">{rm(sp)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{rm(col)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{sp > 0 ? `${Math.round((col / sp) * 1000) / 10}%` : ""}</td>
                            <td colSpan={2} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Location */}
                  <div className="overflow-x-auto">
                    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Location</p>
                      <button onClick={() => openAdd("LOCATION", g.userId)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">+ Add</button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                          <th className={th}>No</th><th className={th}>Customer</th><th className={th}>Location Description</th><th className={th}>Type</th>
                          <th className={th}><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.locs.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-xs text-gray-400">No locations this month.</td></tr>}
                        {g.locs.map((r, i) => (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 text-gray-900">{r.customerName}</td>
                            <td className="px-3 py-2 text-gray-700">{r.locationDescription ?? dash}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.locationType ?? dash}</td>
                            {actions(r)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
