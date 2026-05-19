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
        <EditNameClient
          initialName={session?.user.name ?? ""}
          email={session?.user.email ?? ""}
          roleLabel={roleLabel(session?.user.role)}
        />
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
