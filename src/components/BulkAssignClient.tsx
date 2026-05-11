"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Lead = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  createdAt: Date | string
}

type Salesperson = {
  id: string
  name: string
  _count: { leads: number }
}

interface Props {
  leads: Lead[]
  salespeople: Salesperson[]
}

export default function BulkAssignClient({ leads: initial, salespeople }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTo, setAssignTo] = useState("")
  const [saving, setSaving] = useState(false)

  function toggleAll() {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function assign() {
    if (!assignTo || selected.size === 0) return
    setSaving(true)
    await fetch("/api/leads/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: Array.from(selected), assignedToId: assignTo }),
    })
    setSaving(false)
    setLeads(leads.filter((l) => !selected.has(l.id)))
    setSelected(new Set())
    setAssignTo("")
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Leads</h1>
          <p className="text-sm text-gray-500 mt-1">{leads.length} unassigned leads</p>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">
            {selected.size} selected
          </span>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select salesperson…</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s._count.leads} leads)
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={saving || selected.size === 0 || !assignTo}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Assigning…" : `Assign ${selected.size > 0 ? selected.size : ""} Lead${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm text-gray-400">
                  All leads are assigned.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className={`cursor-pointer ${selected.has(lead.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                onClick={() => toggle(lead.id)}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggle(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {lead.firstName} {lead.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.email ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.phone ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
