"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast"

type DupSibling = {
  id: string
  campaignName?: string | null
  adName?: string | null
  status: string
  assignedTo?: { name: string } | null
}

type Lead = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  adName?: string | null
  campaignName?: string | null
  branch?: string | null
  source?: string | null
  isDuplicate: boolean
  dupSibling?: DupSibling | null
  createdAt: Date | string
}

type Salesperson = {
  id: string
  name: string
  role: string
  _count: { leads: number }
  leads: { id: string }[]
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Manager"
  if (role === "TEAM_LEADER") return "Team Leader"
  return null
}

interface Props {
  leads: Lead[]
  salespeople: Salesperson[]
}

function ageBadge(createdAt: Date | string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days === 0) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">Today</span>
  if (days === 1) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">1d</span>
  if (days <= 3) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{days}d</span>
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-500">{days}d</span>
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Proposal", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
}

function DupBadge({ sibling }: { sibling?: DupSibling | null }) {
  const campaign = sibling?.campaignName ?? sibling?.adName ?? "another campaign"
  const assignee = sibling?.assignedTo?.name ?? null
  const status = sibling ? (STATUS_LABELS[sibling.status] ?? sibling.status) : null

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ring-1 ring-amber-200">DUP</span>
      {sibling && (
        <span className="text-[10px] text-gray-400 leading-tight max-w-[160px]">
          {assignee
            ? <><span className="text-rose-500 font-medium">{assignee}</span> · {campaign} · {status}</>
            : <>Unassigned · {campaign} · {status}</>
          }
        </span>
      )}
    </span>
  )
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "META") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Meta</span>
  if (source === "TIKTOK") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">TikTok</span>
  return null
}

export default function BulkAssignClient({ leads: initial, salespeople }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [leads, setLeads] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTo, setAssignTo] = useState("")
  const [saving, setSaving] = useState(false)

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map((l) => l.id)))
  }

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function assign() {
    if (!assignTo || selected.size === 0) return
    setSaving(true)
    const count = selected.size
    await fetch("/api/leads/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: Array.from(selected), assignedToId: assignTo }),
    })
    const person = salespeople.find(s => s.id === assignTo)
    setSaving(false)
    setLeads(leads.filter((l) => !selected.has(l.id)))
    setSelected(new Set())
    setAssignTo("")
    toast(`${count} lead${count !== 1 ? "s" : ""} assigned to ${person?.name ?? "salesperson"}`)
    router.refresh()
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} unassigned leads</p>
        </div>
      </div>

      {/* Action toolbar */}
      {leads.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className={`text-sm font-medium px-3 py-1.5 rounded-lg ${selected.size > 0 ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}>
            {selected.size > 0 ? `${selected.size} selected` : "Tap leads to select"}
          </div>
          <div className="hidden sm:flex flex-1" />
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 w-full sm:w-auto sm:min-w-[220px]"
          >
            <option value="">Select person…</option>
            {salespeople.map((s) => {
              const rl = roleLabel(s.role)
              return (
                <option key={s.id} value={s.id}>
                  {s.name}{rl ? ` (${rl})` : ""} · {s.leads.length} new · {s._count.leads} total
                </option>
              )
            })}
          </select>
          <button
            onClick={assign}
            disabled={saving || selected.size === 0 || !assignTo}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-40 shadow-sm shadow-blue-200 w-full sm:w-auto"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Assigning…
              </span>
            ) : `Assign ${selected.size > 0 ? selected.size : ""} Lead${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-sm text-gray-400">All leads are assigned.</div>
        ) : (
          <>
            <button onClick={toggleAll} className="w-full text-xs font-medium text-blue-600 py-2 text-left px-1">
              {selected.size === leads.length ? "Deselect all" : "Select all"}
            </button>
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => toggle(lead.id)}
                className={`flex items-start gap-3 rounded-xl border shadow-sm px-4 py-3.5 cursor-pointer transition ${selected.has(lead.id) ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggle(lead.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0 mt-1"
                />
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-500">{(lead.firstName?.[0] ?? "?").toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{lead.firstName} {lead.lastName}</p>
                      <SourceBadge source={lead.source} />
                      {lead.isDuplicate && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ring-1 ring-amber-200 shrink-0">DUP</span>}
                    </div>
                    {ageBadge(lead.createdAt)}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{lead.email ?? lead.phone ?? "—"}</p>
                  {lead.isDuplicate && lead.dupSibling && (
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                      {lead.dupSibling.assignedTo
                        ? <><span className="text-rose-500 font-medium">{lead.dupSibling.assignedTo.name}</span> · {lead.dupSibling.campaignName ?? lead.dupSibling.adName ?? "another campaign"} · {STATUS_LABELS[lead.dupSibling.status] ?? lead.dupSibling.status}</>
                        : <>Unassigned · {lead.dupSibling.campaignName ?? lead.dupSibling.adName ?? "another campaign"} · {STATUS_LABELS[lead.dupSibling.status] ?? lead.dupSibling.status}</>
                      }
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {lead.branch && <span className="text-xs text-gray-500">{lead.branch}</span>}
                    {(lead.campaignName ?? lead.adName) && (
                      <span className="text-xs text-gray-400 truncate">{lead.campaignName ?? lead.adName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Platform</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Ad / Campaign</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><polyline points="20 6 9 17 4 12"/></svg>
                    All leads are assigned.
                  </div>
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className={`cursor-pointer transition ${selected.has(lead.id) ? "bg-blue-50" : "hover:bg-gray-50/70"}`} onClick={() => toggle(lead.id)}>
                <td className="px-5 py-3.5">
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} onClick={(e) => e.stopPropagation()} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gray-500">{(lead.firstName?.[0] ?? "?").toUpperCase()}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium text-gray-900 text-sm">{lead.firstName} {lead.lastName}</span>
                      {lead.isDuplicate && <DupBadge sibling={lead.dupSibling} />}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm">
                  <div className="text-gray-700">{lead.email ?? "—"}</div>
                  {lead.phone && <div className="text-xs text-gray-400 mt-0.5">{lead.phone}</div>}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {lead.branch ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <SourceBadge source={lead.source} />
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[180px] truncate">
                  {lead.campaignName ?? lead.adName ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {ageBadge(lead.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
