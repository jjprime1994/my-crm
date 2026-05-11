import { auth } from "@/auth"
import ChangePasswordClient from "@/components/ChangePasswordClient"

export default async function SettingsPage() {
  const session = await auth()
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Profile</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-blue-600">
              {(session?.user.name?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{session?.user.name}</p>
            <p className="text-sm text-gray-400">{session?.user.email}</p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {session?.user.role === "SUPER_ADMIN" ? "Super Admin" : session?.user.role === "ADMIN" ? "Admin" : "Salesperson"}
            </p>
          </div>
        </div>
      </div>

      <ChangePasswordClient />
    </div>
  )
}
