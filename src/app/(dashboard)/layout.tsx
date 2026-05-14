import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getViewAsRole, getCurrentViewAs } from "@/lib/viewas"
import DashboardShell from "@/components/DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const actualRole = session.user.role ?? "SALESPERSON"
  const isSuperAdmin = actualRole === "SUPER_ADMIN"

  const [effectiveRole, currentViewAs] = await Promise.all([
    getViewAsRole(actualRole),
    isSuperAdmin ? getCurrentViewAs() : Promise.resolve(null),
  ])

  const effectiveUser = { ...session.user, role: effectiveRole }
  const viewingAs = isSuperAdmin && currentViewAs ? currentViewAs : null

  return (
    <DashboardShell
      user={effectiveUser}
      viewingAs={viewingAs}
      isSuperAdmin={isSuperAdmin}
    >
      {children}
    </DashboardShell>
  )
}
