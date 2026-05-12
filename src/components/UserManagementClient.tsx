"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type User = {
  id: string
  name: string
  email: string
  role: string
  claimLimit: number
  newLeadThreshold: number
  managerId: string | null
  createdAt: Date | string
  _count: { leads: number }
}

interface Props {
  users: User[]
  currentUserId: string
  isSuperAdmin: boolean
  managers: { id: string; name: string }[]
}

function initials(name: string) {
  const parts = name.trim().split(" ")
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

export default function UserManagementClient({ users: initial, currentUserId, isSuperAdmin, managers }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESPERSON" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingLimit, setEditingLimit] = useState<{ id: string; value: number } | null>(null)
  const [editingThreshold, setEditingThreshold] = useState<{ id: string; value: number } | null>(null)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")

  async function saveResetPassword(id: string) {
    if (!newPassword || newPassword.length < 8) { setResetError("Password must be at least 8 characters."); return }
    setResetSaving(true)
    setResetError("")
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    })
    setResetSaving(false)
    if (!res.ok) { setResetError("Failed to reset password."); return }
    setResetSuccess(users.find((u) => u.id === id)?.name ?? "User")
    setResettingPassword(null)
    setNewPassword("")
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      setError("Failed to create user. Email may already exist.")
      return
    }
    setForm({ name: "", email: "", password: "", role: "SALESPERSON" })
    setShowForm(false)
    router.refresh()
  }

  async function deleteUser(id: string) {
    if (!confirm("Remove this user? Their leads will become unassigned.")) return
    await fetch(`/api/users/${id}`, { method: "DELETE" })
    setUsers(users.filter((u) => u.id !== id))
  }

  async function saveClaimLimit(id: string, value: number) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimLimit: value }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, claimLimit: value } : u)))
    setEditingLimit(null)
  }

  async function saveThreshold(id: string, value: number) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newLeadThreshold: value }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, newLeadThreshold: value } : u)))
    setEditingThreshold(null)
  }

  async function saveManagerId(id: string, managerId: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: managerId || null }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, managerId: managerId || null } : u)))
  }

  async function saveRole(id: string, role: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, role } : u)))
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} team members</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`text-sm font-semibold px-4 py-2 rounded-xl transition ${
            showForm
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
          }`}
        >
          {showForm ? "Cancel" : "+ Add Member"}
        </button>
      </div>

      {resetSuccess && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          Password reset for <strong>{resetSuccess}</strong>.
          <button onClick={() => setResetSuccess("")} className="ml-auto text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={addUser} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">New Team Member</h2>
          {error && (
            <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Full Name", key: "name", type: "text", placeholder: "Juan dela Cruz" },
              { label: "Email", key: "email", type: "email", placeholder: "juan@example.com" },
              { label: "Password", key: "password", type: "password", placeholder: "••••••••" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                <input
                  type={type}
                  required
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
              >
                <option value="SALESPERSON">Salesperson</option>
                {isSuperAdmin && <option value="ADMIN">Manager</option>}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 shadow-sm shadow-blue-200"
            >
              {saving ? "Creating…" : "Create Account"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Claim Limit / 15min</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Max New Leads</th>
              {isSuperAdmin && <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager</th>}
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/70 transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      user.role === "SUPER_ADMIN" ? "bg-amber-100" : user.role === "ADMIN" ? "bg-violet-100" : "bg-blue-100"
                    }`}>
                      <span className={`text-xs font-bold ${
                        user.role === "SUPER_ADMIN" ? "text-amber-600" : user.role === "ADMIN" ? "text-violet-600" : "text-blue-600"
                      }`}>
                        {initials(user.name)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {isSuperAdmin && true ? (
                    <select
                      value={user.role}
                      onChange={(e) => saveRole(user.id, e.target.value)}
                      className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
                    >
                      <option value="SALESPERSON">Salesperson</option>
                      <option value="ADMIN">Manager</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                      user.role === "SUPER_ADMIN"
                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        : user.role === "ADMIN"
                        ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {user.role === "SUPER_ADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Manager" : "Salesperson"}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-semibold text-gray-900">{user._count.leads}</span>
                  <span className="text-xs text-gray-400 ml-1">leads</span>
                </td>
                <td className="px-5 py-4">
                  {user.role !== "SUPER_ADMIN" ? (
                    editingLimit?.id === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editingLimit.value}
                          onChange={(e) => setEditingLimit({ id: user.id, value: Number(e.target.value) })}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        />
                        <button
                          onClick={() => saveClaimLimit(user.id, editingLimit.value)}
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLimit(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {user.claimLimit}
                        </span>
                        <button
                          onClick={() => setEditingLimit({ id: user.id, value: user.claimLimit })}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {user.role !== "SUPER_ADMIN" ? (
                    editingThreshold?.id === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={editingThreshold.value}
                          onChange={(e) => setEditingThreshold({ id: user.id, value: Number(e.target.value) })}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        />
                        <button
                          onClick={() => saveThreshold(user.id, editingThreshold.value)}
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingThreshold(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${user.newLeadThreshold === 0 ? "bg-gray-100 text-gray-400" : "bg-amber-50 text-amber-700"}`}>
                          {user.newLeadThreshold === 0 ? "Off" : user.newLeadThreshold}
                        </span>
                        <button
                          onClick={() => setEditingThreshold({ id: user.id, value: user.newLeadThreshold })}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                {isSuperAdmin && (
                  <td className="px-5 py-4">
                    {user.role === "SALESPERSON" ? (
                      <select
                        value={user.managerId ?? ""}
                        onChange={(e) => saveManagerId(user.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 max-w-[140px]"
                      >
                        <option value="">Unassigned</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                )}
                <td className="px-5 py-4 text-sm text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {resettingPassword === user.id ? (
                      <div className="flex items-center gap-2">
                        {resetError && <span className="text-xs text-rose-500">{resetError}</span>}
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveResetPassword(user.id)}
                          disabled={resetSaving}
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          {resetSaving ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => { setResettingPassword(null); setNewPassword(""); setResetError("") }}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setResettingPassword(user.id); setResetError("") }}
                        className="text-xs font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Reset pw
                      </button>
                    )}
                    {user.id !== currentUserId && resettingPassword !== user.id && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
