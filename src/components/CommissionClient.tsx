"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"
import { COMMISSION_TYPES, PACKAGE_TYPES, comparePeople, monthLabel, type CommissionKindStr, type CommissionRow } from "@/lib/commission"

type Person = { id: string; name: string; role: string; disabled: boolean; teamId: string | null; teamLabel: string | null }

const NO_TEAM = "__none"

interface Props {
  kind: CommissionKindStr
  month: string
  meId: string
  canExport: boolean
  showTeams: boolean
  users: Person[]
  claims: CommissionRow[]
}

type FieldType = "text" | "number" | "date" | "commissionType" | "packageType"
type Field = { key: keyof CommissionRow; label: string; type: FieldType; required?: boolean; money?: boolean; wide?: boolean }

// Column order follows the MA / LA sheets of Commission Templete 2026.xlsx
const MA_FIELDS: Field[] = [
  { key: "branch", label: "Branch", type: "text" },
  { key: "customerName", label: "Customer Name (As per PO Name)", type: "text", required: true, wide: true },
  { key: "commissionType", label: "Types of Commission", type: "commissionType" },
  { key: "packageType", label: "Package Type", type: "packageType" },
  { key: "machineType", label: "Type of Machine", type: "text" },
  { key: "poNo", label: "PO No", type: "text" },
  { key: "poDate", label: "PO Date", type: "date" },
  { key: "sellingPrice", label: "Selling Price (RM)", type: "number", money: true },
  { key: "totalCollection", label: "Total Collection Amount", type: "number", money: true },
  { key: "lastPaymentDate", label: "Last Payment Date", type: "date" },
  { key: "machineCount", label: "No of Machine", type: "number" },
  { key: "kpi", label: "KPI", type: "number" },
  { key: "incentive", label: "Incentive (RM)", type: "number", money: true },
  { key: "paymentMadePct", label: "Payment Made (%)", type: "number" },
  { key: "amountClaim", label: "Amount Claim (RM)", type: "number", required: true, money: true },
]

const LA_FIELDS: Field[] = [
  { key: "branch", label: "Branch", type: "text" },
  { key: "customerName", label: "Customer Name (As per PO Name)", type: "text", required: true, wide: true },
  { key: "commissionType", label: "Types of Commission", type: "commissionType" },
  { key: "packageType", label: "Package Type", type: "packageType" },
  { key: "machinePoNo", label: "Machine PO No", type: "text" },
  { key: "locationPoNo", label: "Location PO No", type: "text" },
  { key: "locationName", label: "Location Name", type: "text", wide: true },
  { key: "paymentMadePct", label: "Payment Made (%)", type: "number" },
  { key: "amountClaim", label: "Amount Claim (RM)", type: "number", required: true, money: true },
]

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

type FormState = { id: string | null; userId: string; values: Record<string, string> }

function emptyValues(fields: Field[]) {
  return Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<string, string>
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export default function CommissionClient({ kind, month, meId, canExport, showTeams, users, claims: initial }: Props) {
  const fields = kind === "MA" ? MA_FIELDS : LA_FIELDS
  const title = kind === "MA" ? "MA – Sales Commission" : "LA – Location Commission"
  const router = useRouter()
  const toast = useToast()

  const [claims, setClaims] = useState(initial)
  const [personFilter, setPersonFilter] = useState<string>("ALL")
  const [teamFilter, setTeamFilter] = useState<string>("ALL")
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const multi = users.length > 1
  const nameOf = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  const personOf = useMemo(
    () => new Map(users.map((u) => [u.id, { id: u.id, name: u.name, role: u.role, team: u.teamLabel }])),
    [users]
  )
  const byRank = (a: string, b: string) => {
    const pa = personOf.get(a) ?? { id: a, name: "", role: "", team: null }
    const pb = personOf.get(b) ?? { id: b, name: "", role: "", team: null }
    return comparePeople(pa, pb, meId)
  }
  const teamOf = useMemo(() => new Map(users.map((u) => [u.id, u.teamId ?? NO_TEAM])), [users])

  // Team summary (Super Admin): total claimed per team for this month, "No team" last
  const teamStats = useMemo(() => {
    const labels = new Map<string, string>()
    for (const u of users) labels.set(u.teamId ?? NO_TEAM, u.teamLabel ?? "No team")
    return [...labels.entries()]
      .map(([key, label]) => {
        const rs = claims.filter((c) => (teamOf.get(c.userId) ?? NO_TEAM) === key)
        return { key, label, people: new Set(rs.map((r) => r.userId)).size, rows: rs.length, total: rs.reduce((s, r) => s + r.amountClaim, 0) }
      })
      .sort((a, b) => (a.key === NO_TEAM ? 1 : b.key === NO_TEAM ? -1 : b.total - a.total || a.label.localeCompare(b.label)))
  }, [users, claims, teamOf])
  const visibleUsers = (teamFilter === "ALL" ? users : users.filter((u) => (u.teamId ?? NO_TEAM) === teamFilter))
    .slice()
    .sort((a, b) => byRank(a.id, b.id))
  const activeUsers = users.filter((u) => !u.disabled || u.id === meId)

  // Group rows per person, like the "Name:" blocks in the template
  const groups = useMemo(() => {
    const map = new Map<string, CommissionRow[]>()
    for (const c of claims) {
      if (personFilter !== "ALL" && c.userId !== personFilter) continue
      if (teamFilter !== "ALL" && (teamOf.get(c.userId) ?? NO_TEAM) !== teamFilter) continue
      map.set(c.userId, [...(map.get(c.userId) ?? []), c])
    }
    return [...map.entries()]
      .map(([userId, rows]) => ({ userId, name: nameOf.get(userId) ?? "Unknown", rows, total: rows.reduce((s, r) => s + r.amountClaim, 0) }))
      .sort((a, b) => byRank(a.userId, b.userId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, personFilter, teamFilter, nameOf, teamOf, personOf, meId])

  const grandTotal = groups.reduce((s, g) => s + g.total, 0)
  const rowCount = groups.reduce((s, g) => s + g.rows.length, 0)

  function openAdd() {
    setForm({ id: null, userId: personFilter !== "ALL" ? personFilter : meId, values: emptyValues(fields) })
  }

  function openEdit(c: CommissionRow) {
    const values = emptyValues(fields)
    for (const f of fields) {
      const v = c[f.key]
      values[f.key] = v === null || v === undefined ? "" : String(v)
    }
    setForm({ id: c.id, userId: c.userId, values })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    const body = { kind, month, userId: form.userId, ...form.values }
    const res = await fetch(form.id ? `/api/commission/${form.id}` : "/api/commission", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return toast(j.error ?? "Couldn't save.", "error")
    const row = j as CommissionRow
    setClaims((prev) => (form.id ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row]))
    toast(form.id ? "Claim updated." : "Claim added.")
    setForm(null)
  }

  async function remove(c: CommissionRow) {
    if (!confirm(`Delete the claim for "${c.customerName}" (RM ${rm(c.amountClaim)})?`)) return
    setDeleting(c.id)
    const res = await fetch(`/api/commission/${c.id}`, { method: "DELETE" })
    setDeleting(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast(j.error ?? "Couldn't delete.", "error")
    }
    setClaims((prev) => prev.filter((x) => x.id !== c.id))
    toast("Claim deleted.")
  }

  function display(c: CommissionRow, f: Field) {
    const v = c[f.key]
    if (v === null || v === undefined || v === "") return <span className="text-gray-300">–</span>
    if (f.money && typeof v === "number") return rm(v)
    return String(v)
  }

  function renderInput(f: Field) {
    if (!form) return null
    const value = form.values[f.key] ?? ""
    const set = (v: string) => setForm({ ...form, values: { ...form.values, [f.key]: v } })
    const id = `f-${f.key}`
    if (f.type === "commissionType" || f.type === "packageType") {
      const opts = f.type === "commissionType" ? COMMISSION_TYPES : PACKAGE_TYPES
      return (
        <select id={id} value={value} onChange={(e) => set(e.target.value)} className={inputCls}>
          <option value="">— Select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input
        id={id}
        type={f.type === "number" ? "number" : f.type}
        step={f.type === "number" ? "any" : undefined}
        inputMode={f.type === "number" ? "decimal" : undefined}
        required={f.required}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={inputCls}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            NU VENDING SDN BHD – {kind === "MA" ? "Sales" : "Location"} commission for {monthLabel(month)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.push(`/commission/${kind.toLowerCase()}?month=${shiftMonth(month, -1)}`)}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous month">‹</button>
          <label htmlFor="c-month" className="sr-only">Month</label>
          <input id="c-month" type="month" value={month}
            onChange={(e) => e.target.value && router.push(`/commission/${kind.toLowerCase()}?month=${e.target.value}`)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push(`/commission/${kind.toLowerCase()}?month=${shiftMonth(month, 1)}`)}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next month">›</button>
          {canExport && (
            <a href={`/api/commission/export?kind=${kind}&month=${month}`}
              className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              Export Excel
            </a>
          )}
          <button onClick={openAdd} className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
            + Add claim
          </button>
        </div>
      </div>

      {/* Summary + person filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
          <p className="text-xs text-gray-500 font-medium">
            {personFilter !== "ALL" ? "Total claimed" : teamFilter !== "ALL" ? `Total claimed – ${teamStats.find((t) => t.key === teamFilter)?.label ?? ""}` : multi ? (showTeams ? "Total claimed (all teams)" : "Total claimed (team)") : "Total claimed"}
          </p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">RM {rm(grandTotal)}</p>
          <p className="text-xs text-gray-500">{rowCount} row{rowCount === 1 ? "" : "s"}</p>
        </div>
        {showTeams && teamStats.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="c-team" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Team</label>
            <select id="c-team" value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); setPersonFilter("ALL") }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
              <option value="ALL">All teams</option>
              {teamStats.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        )}
        {multi && (
          <div className="flex items-center gap-2">
            <label htmlFor="c-person" className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Person</label>
            <select id="c-person" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
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
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2">Team</th>
                <th className="px-3 py-2 text-right">People claiming</th>
                <th className="px-3 py-2 text-right">Rows</th>
                <th className="px-5 py-2 text-right">Amount Claim (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teamStats.map((t) => (
                <tr key={t.key} onClick={() => { setTeamFilter(teamFilter === t.key ? "ALL" : t.key); setPersonFilter("ALL") }}
                  className={`cursor-pointer transition ${teamFilter === t.key ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <td className="px-5 py-2 font-medium text-gray-900">
                    <button type="button" className="text-left hover:text-blue-700" aria-pressed={teamFilter === t.key}>{t.label}</button>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{t.people}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{t.rows}</td>
                  <td className={`px-5 py-2 text-right tabular-nums font-semibold ${t.total > 0 ? "text-gray-900" : "text-gray-300"}`}>{rm(t.total)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50/60 font-semibold">
                <td className="px-5 py-2" colSpan={3}>ALL TEAMS</td>
                <td className="px-5 py-2 text-right tabular-nums">{rm(teamStats.reduce((s, t) => s + t.total, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit form */}
      {form && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{form.id ? "Edit claim" : "New claim"} · {monthLabel(month)}</p>
            <button type="button" onClick={() => setForm(null)} className="text-xs text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
          {multi && (
            <div className="max-w-xs">
              <label htmlFor="f-user" className="block text-xs font-medium text-gray-600 mb-1">Claim for</label>
              <select id="f-user" value={form.userId} disabled={!!form.id}
                onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls}>
                {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === meId ? " (you)" : ""}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <label htmlFor={`f-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}{f.required && <span className="text-rose-500"> *</span>}
                </label>
                {renderInput(f)}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="text-sm px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
              {saving ? "Saving…" : form.id ? "Save changes" : "Add claim"}
            </button>
          </div>
        </form>
      )}

      {/* One block per person */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-500">
          No {kind} claims for {monthLabel(month)} yet. Click <span className="font-semibold">+ Add claim</span> to add one.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.userId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50/60">
              <p className="text-sm font-semibold text-gray-900">Name: {g.name}{g.userId === meId && <span className="ml-1.5 text-xs text-blue-600">(you)</span>}</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">RM {rm(g.total)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-3 py-2">No.</th>
                    {fields.map((f) => (
                      <th key={f.key} className={`px-3 py-2 whitespace-nowrap ${f.type === "number" ? "text-right" : ""}`}>{f.label}</th>
                    ))}
                    <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {g.rows.map((c, i) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      {fields.map((f) => (
                        <td key={f.key} className={`px-3 py-2 whitespace-nowrap ${f.type === "number" ? "text-right tabular-nums" : ""} ${f.key === "amountClaim" ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {display(c, f)}
                        </td>
                      ))}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <button onClick={() => openEdit(c)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 mr-3">Edit</button>
                        <button onClick={() => remove(c)} disabled={deleting === c.id} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40">
                          {deleting === c.id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/60 font-semibold">
                    <td className="px-3 py-2" colSpan={fields.length}>TOTAL AMOUNT</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rm(g.total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
