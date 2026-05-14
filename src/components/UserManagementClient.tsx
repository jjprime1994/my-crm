"use client"

import { useState } from "react"

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
  isTeamLeader: boolean
  isManager: boolean
  managers: { id: string; name: string }[]
}

function initials(name: string) {
  const parts = name.trim().split(" ")
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

function roleLabel(role: string) {
  if (role === "SUPER_ADMIN") return "Super Admin"
  if (role === "ADMIN") return "Manager"
  if (role === "TEAM_LEADER") return "Team Leader"
  return "Salesperson"
}

function roleBadgeClass(role: string) {
  if (role === "SUPER_ADMIN") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
  if (role === "ADMIN") return "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
  if (role === "TEAM_LEADER") return "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
  return "bg-gray-100 text-gray-600"
}

function avatarClass(role: string) {
  if (role === "SUPER_ADMIN") return "bg-amber-100"
  if (role === "ADMIN") return "bg-violet-100"
  if (role === "TEAM_LEADER") return "bg-teal-100"
  return "bg-blue-100"
}

function avatarTextClass(role: string) {
  if (role === "SUPER_ADMIN") return "text-amber-600"
  if (role === "ADMIN") return "text-violet-600"
  if (role === "TEAM_LEADER") return "text-teal-600"
  return "text-blue-600"
}

export default function UserManagementClient({ users: initial, currentUserId, isSuperAdmin, isTeamLeader, isManager, managers }: Props) {
  const [users, setUsers] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESPERSON" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null)
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

  async function saveName(id: string, name: string) {
    if (!name.trim()) return
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, name: name.trim() } : u)))
    setEditingName(null)
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
    const newUser = await res.json()
    setUsers((prev) => [...prev, newUser])
    setForm({ name: "", email: "", password: "", role: "SALESPERSON" })
    setShowForm(false)
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
                {(isSuperAdmin || isManager) && <option value="TEAM_LEADER">Team Leader</option>}
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
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Leads</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Claim / 15min</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Max New</th>
              {isSuperAdmin && <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager</th>}
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/70 transition">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${avatarClass(user.role)}`}>
                      <span className={`text-xs font-bold ${avatarTextClass(user.role)}`}>
                        {initials(user.name)}
                      </span>
                    </div>
                    <div>
                      {editingName?.id === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName.value}
                            onChange={(e) => setEditingName({ id: user.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName(user.id, editingName.value)
                              if (e.key === "Escape") setEditingName(null)
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                            autoFocus
                          />
                          <button onClick={() => saveName(user.id, editingName.value)} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-lg transition">Save</button>
                          <button onClick={() => setEditingName(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition">✕</button>
                        </div>
                      ) : (
                        <p
                          className="font-medium text-gray-900 text-sm cursor-pointer hover:text-blue-600 transition"
                          onClick={() => setEditingName({ id: user.id, value: user.name })}
                          title="Click to edit name"
                        >
                          {user.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {isSuperAdmin ? (
                    <select
                      value={user.role}
                      onChange={(e) => saveRole(user.id, e.target.value)}
                      className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
                    >
                      <option value="SALESPERSON">Salesperson</option>
                      <option value="TEAM_LEADER">Team Leader</option>
                      <option value="ADMIN">Manager</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${roleBadgeClass(user.role)}`}>
                      {roleLabel(user.role)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-semibold text-gray-900">{user._count.leads}</span>
                  <span className="text-xs text-gray-400 ml-1">leads</span>
                </td>
                <td className="px-4 py-4">
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
                <td className="px-4 py-4">
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
                  <td className="px-4 py-4">
                    {user.role === "SALESPERSON" || user.role === "TEAM_LEADER" ? (
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
                <td className="px-4 py-4 text-sm text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {resettingPassword === user.id ? (
                      <div className="flex items-center gap-1.5">
                        {resetError && <span className="text-xs text-rose-500">{resetError}</span>}
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="text-xs text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setResettingPassword(user.id); setResetError("") }}
                        title="Reset password"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </button>
                    )}
                    {user.id !== currentUserId && resettingPassword !== user.id && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        title="Remove user"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
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
