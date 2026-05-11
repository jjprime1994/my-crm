"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type User = {
  id: string
  name: string
  email: string
  role: string
  claimLimit: number
  createdAt: Date | string
  _count: { leads: number }
}

interface Props {
  users: User[]
  currentUserId: string
}

export default function UserManagementClient({ users: initial, currentUserId }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESPERSON" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingLimit, setEditingLimit] = useState<{ id: string; value: number } | null>(null)

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
    if (res.ok) {
      setUsers(users.map((u) => (u.id === id ? { ...u, claimLimit: value } : u)))
    }
    setEditingLimit(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {showForm ? "Cancel" : "+ Add Salesperson"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addUser} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New Team Member</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Juan dela Cruz"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="juan@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SALESPERSON">Salesperson</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Account"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leads</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim Limit / 15min</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                    {user.role === "ADMIN" ? "Admin" : "Salesperson"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{user._count.leads}</td>
                <td className="px-4 py-3">
                  {user.role === "SALESPERSON" ? (
                    editingLimit?.id === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editingLimit.value}
                          onChange={(e) => setEditingLimit({ id: user.id, value: Number(e.target.value) })}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => saveClaimLimit(user.id, editingLimit.value)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLimit(null)}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{user.claimLimit}</span>
                        <button
                          onClick={() => setEditingLimit({ id: user.id, value: user.claimLimit })}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
