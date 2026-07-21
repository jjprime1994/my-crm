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
  disabled: boolean
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
  if (role === "ADMIN") return "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
  if (role === "TEAM_LEADER") return "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
  return "bg-gray-100 text-gray-600"
}

// Shape encodes role independent of colour: square = management, circle = individual
function avatarClass(role: string) {
  if (role === "SUPER_ADMIN") return "bg-amber-100 rounded-xl"
  if (role === "ADMIN") return "bg-blue-100 rounded-xl"
  if (role === "TEAM_LEADER") return "bg-teal-100 rounded-full ring-2 ring-teal-300"
  return "bg-gray-100 rounded-full"
}

function avatarTextClass(role: string) {
  if (role === "SUPER_ADMIN") return "text-amber-600"
  if (role === "ADMIN") return "text-blue-600"
  if (role === "TEAM_LEADER") return "text-teal-600"
  return "text-gray-500"
}

export default function UserManagementClient({ users: initial, currentUserId, isSuperAdmin, isTeamLeader, isManager, managers }: Props) {
  const [users, setUsers] = useState(initial)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [managerFilter, setManagerFilter] = useState("")
  const [sortBy, setSortBy] = useState("name")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESPERSON" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null)
  const [editingLimit, setEditingLimit] = useState<{ id: string; value: number } | null>(null)
  const [editingThreshold, setEditingThreshold] = useState<{ id: string; value: number } | null>(null)
  const [applyingAll, setApplyingAll] = useState(false)
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
    if (!confirm("Permanently delete this user? This cannot be undone.")) return
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const message = await res.text()
      alert(message || "Failed to delete user.")
      return
    }
    setUsers(users.filter((u) => u.id !== id))
  }

  async function toggleDisabled(id: string, disabled: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    })
    if (res.ok) setUsers(users.map((u) => (u.id === id ? { ...u, disabled } : u)))
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

  async function applyClaimLimitToAll(value: number) {
    setApplyingAll(true)
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimLimit: value }),
    })
    setApplyingAll(false)
    if (res.ok) setUsers(users.map((u) => (u.role !== "SUPER_ADMIN" ? { ...u, claimLimit: value } : u)))
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

  const filteredUsers = users
    .filter((u) => {
      if (search) {
        const q = search.toLowerCase()
        const teamName = managers.find((m) => m.id === u.managerId)?.name ?? ""
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !teamName.toLowerCase().includes(q)
        ) return false
      }
      if (roleFilter && u.role !== roleFilter) return false
      if (managerFilter === "__none__" && u.managerId !== null) return false
      if (managerFilter && managerFilter !== "__none__" && u.managerId !== managerFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name)
      if (sortBy === "name_desc") return b.name.localeCompare(a.name)
      if (sortBy === "leads_desc") return b._count.leads - a._count.leads
      if (sortBy === "leads_asc") return a._count.leads - b._count.leads
      if (sortBy === "joined_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === "joined_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return a.name.localeCompare(b.name)
    })

  const activeFilters = [search, roleFilter, managerFilter].filter(Boolean).length

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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition text-gray-700"
        >
          <option value="">All roles</option>
          <option value="SALESPERSON">Salesperson</option>
          <option value="TEAM_LEADER">Team Leader</option>
          <option value="ADMIN">Manager</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        {isSuperAdmin && managers.length > 0 && (
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition text-gray-700"
          >
            <option value="">All teams</option>
            <option value="__none__">Unassigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition text-gray-700"
        >
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="leads_desc">Most leads</option>
          <option value="leads_asc">Fewest leads</option>
          <option value="joined_desc">Newest first</option>
          <option value="joined_asc">Oldest first</option>
        </select>
        {activeFilters > 0 && (
          <button
            onClick={() => { setSearch(""); setRoleFilter(""); setManagerFilter("") }}
            className="text-sm text-rose-500 hover:text-rose-700 font-medium px-3 py-2 rounded-xl hover:bg-rose-50 transition flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear ({activeFilters})
          </button>
        )}
        <p className="w-full text-xs text-gray-400 px-1">{filteredUsers.length} of {users.length} members</p>
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {filteredUsers.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-10 text-sm text-gray-400">No members match your filters.</div>
        )}
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            {/* Header: avatar + name/email | action icons */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${avatarClass(user.role)}`}>
                <span className={`text-xs font-bold ${avatarTextClass(user.role)}`}>{initials(user.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
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
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                      autoFocus
                    />
                    <button onClick={() => saveName(user.id, editingName.value)} className="text-xs font-semibold text-white bg-blue-600 px-2 py-1 rounded-lg shrink-0">Save</button>
                    <button onClick={() => setEditingName(null)} className="text-xs text-gray-400 p-1 rounded-lg hover:bg-gray-100">✕</button>
                  </div>
                ) : (
                  <p
                    className="font-semibold text-gray-900 text-sm truncate cursor-pointer hover:text-blue-600"
                    onClick={() => setEditingName({ id: user.id, value: user.name })}
                  >
                    {user.name}
                  </p>
                )}
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
              {/* Action icons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setResettingPassword(resettingPassword === user.id ? null : user.id); setResetError(""); setNewPassword("") }}
                  title="Reset password"
                  className={`p-1.5 rounded-xl transition ${resettingPassword === user.id ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </button>
                {isSuperAdmin && user.id !== currentUserId && (
                  <button
                    onClick={() => toggleDisabled(user.id, !user.disabled)}
                    title={user.disabled ? "Re-enable login" : "Disable login"}
                    className={`p-1.5 rounded-xl transition ${user.disabled ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                  >
                    {user.disabled ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    )}
                  </button>
                )}
                {isSuperAdmin && user.id !== currentUserId && (
                  <button
                    onClick={() => deleteUser(user.id)}
                    title="Delete user"
                    className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Role row */}
            <div className="flex items-center gap-2 flex-wrap">
              {isSuperAdmin ? (
                <select
                  value={user.role}
                  onChange={(e) => saveRole(user.id, e.target.value)}
                  className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
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
              {user.disabled && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                  Disabled
                </span>
              )}
            </div>

            {/* Stats row */}
            {user.role !== "SUPER_ADMIN" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Leads</p>
                  <p className="text-sm font-bold text-gray-900">{user._count.leads}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Claim / day</p>
                  {editingLimit?.id === user.id ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <input
                        type="number"
                        min={1} max={500}
                        value={editingLimit.value}
                        onChange={(e) => setEditingLimit({ id: user.id, value: Number(e.target.value) })}
                        className="w-12 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-1">
                        <button onClick={() => saveClaimLimit(user.id, editingLimit.value)} className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded">✓</button>
                        <button onClick={() => applyClaimLimitToAll(editingLimit.value)} disabled={applyingAll} className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded disabled:opacity-50">{applyingAll ? "…" : "All"}</button>
                        <button onClick={() => setEditingLimit(null)} className="text-[10px] text-gray-400 px-2 py-0.5 rounded hover:bg-gray-200">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditingLimit({ id: user.id, value: user.claimLimit })} className="w-full flex flex-col items-center gap-0.5 group">
                      <span className="text-sm font-bold text-gray-900">{user.claimLimit}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 group-hover:text-blue-400 transition"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Max New</p>
                  {editingThreshold?.id === user.id ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <input
                        type="number"
                        min={0} max={200}
                        value={editingThreshold.value}
                        onChange={(e) => setEditingThreshold({ id: user.id, value: Number(e.target.value) })}
                        className="w-12 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-1">
                        <button onClick={() => saveThreshold(user.id, editingThreshold.value)} className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded">✓</button>
                        <button onClick={() => setEditingThreshold(null)} className="text-[10px] text-gray-400 px-2 py-0.5 rounded hover:bg-gray-200">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditingThreshold({ id: user.id, value: user.newLeadThreshold })} className="w-full flex flex-col items-center gap-0.5 group">
                      <span className={`text-sm font-bold ${user.newLeadThreshold === 0 ? "text-gray-400" : "text-amber-600"}`}>
                        {user.newLeadThreshold === 0 ? "Off" : user.newLeadThreshold}
                      </span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 group-hover:text-blue-400 transition"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Manager select (super admin only) */}
            {isSuperAdmin && (user.role === "SALESPERSON" || user.role === "TEAM_LEADER") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">Manager</span>
                <select
                  value={user.managerId ?? ""}
                  onChange={(e) => saveManagerId(user.id, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                >
                  <option value="">Unassigned</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Footer: joined date */}
            <div className="pt-2 border-t border-gray-50">
              <span className="text-xs text-gray-400">
                Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>

            {/* Inline password reset */}
            {resettingPassword === user.id && (
              <div className="pt-2 border-t border-gray-50 space-y-2">
                {resetError && <p className="text-xs text-rose-500">{resetError}</p>}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => saveResetPassword(user.id)}
                    disabled={resetSaving}
                    className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition disabled:opacity-50 shrink-0"
                  >
                    {resetSaving ? "…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Role</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-16">Leads</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Claim / day</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Max New</th>
              {isSuperAdmin && <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-32">Manager</th>}
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">Joined</th>
              <th className="px-4 py-3.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={isSuperAdmin ? 8 : 7} className="text-center py-12 text-sm text-gray-400">No members match your filters.</td></tr>
            )}
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/70 transition">
                <td className="px-4 py-4 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 flex items-center justify-center shrink-0 ${avatarClass(user.role)}`}>
                      <span className={`text-xs font-bold ${avatarTextClass(user.role)}`}>
                        {initials(user.name)}
                      </span>
                    </div>
                    <div className="min-w-0">
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
                          className="font-medium text-gray-900 text-sm cursor-pointer hover:text-blue-600 transition truncate"
                          onClick={() => setEditingName({ id: user.id, value: user.name })}
                          title={user.name}
                        >
                          {user.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
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
                  {user.disabled && (
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 ml-1.5">
                      Disabled
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
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={500}
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
                          onClick={() => applyClaimLimitToAll(editingLimit.value)}
                          disabled={applyingAll}
                          className="text-xs font-semibold text-violet-600 hover:text-white bg-violet-50 hover:bg-violet-600 border border-violet-200 hover:border-transparent px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          {applyingAll ? "Applying…" : "Apply to All"}
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
                    {isSuperAdmin && user.id !== currentUserId && resettingPassword !== user.id && (
                      <button
                        onClick={() => toggleDisabled(user.id, !user.disabled)}
                        title={user.disabled ? "Re-enable login" : "Disable login"}
                        className={`p-1.5 rounded-lg transition ${user.disabled ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                      >
                        {user.disabled ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        )}
                      </button>
                    )}
                    {isSuperAdmin && user.id !== currentUserId && resettingPassword !== user.id && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        title="Delete user"
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

