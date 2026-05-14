import { auth } from "@/auth"
import ChangePasswordClient from "@/components/ChangePasswordClient"
import EnableNotifications from "@/components/EnableNotifications"
import EditNameClient from "@/components/EditNameClient"

function roleLabel(role?: string | null) {
  if (role === "SUPER_ADMIN") return "Super Admin"
  if (role === "ADMIN") return "Manager"
  if (role === "TEAM_LEADER") return "Team Leader"
  return "Salesperson"
}

export default async function SettingsPage() {
  const session = await auth()
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Profile</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-blue-600">
              {(session?.user.name?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{session?.user.name}</p>
            <p className="text-sm text-gray-400">{session?.user.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{roleLabel(session?.user.role)}</p>
          </div>
        </div>
        <EditNameClient currentName={session?.user.name ?? ""} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Notifications</p>
        <p className="text-sm text-gray-500">Get alerted when a lead is assigned to you.</p>
        <EnableNotifications />
      </div>

      <ChangePasswordClient />
    </div>
  )
}
