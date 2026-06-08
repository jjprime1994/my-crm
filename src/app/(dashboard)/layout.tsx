import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getViewAsRole, getCurrentViewAs } from "@/lib/viewas"
import DashboardShell from "@/components/DashboardShell"
import { db } from "@/lib/db"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const actualRole = session.user.role ?? "SALESPERSON"
  const isSuperAdmin = actualRole === "SUPER_ADMIN"

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const [effectiveRole, currentViewAs, followUpsCount, availableLeadsCount] = await Promise.all([
    getViewAsRole(actualRole),
    isSuperAdmin ? getCurrentViewAs() : Promise.resolve(null),
    db.lead.count({
      where: {
        assignedToId: session.user.id,
        followUpAt: { lte: endOfToday },
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
    }).catch(() => 0),
    db.lead.count({
      where: { assignedToId: null, isDuplicate: false },
    }).catch(() => 0),
  ])

  const effectiveUser = { ...session.user, role: effectiveRole }
  const viewingAs = isSuperAdmin && currentViewAs ? currentViewAs : null

  return (
    <DashboardShell
      user={effectiveUser}
      viewingAs={viewingAs}
      isSuperAdmin={isSuperAdmin}
      counts={{ followUps: followUpsCount, availableLeads: availableLeadsCount }}
    >
      {children}
    </DashboardShell>
  )
}
