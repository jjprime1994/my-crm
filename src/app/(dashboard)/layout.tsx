import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"
import DashboardShell from "@/components/DashboardShell"
import { db } from "@/lib/db"
import { getAvailableLeadsCount } from "@/lib/available-leads"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  // A disabled user's JWT can still be valid (no live session store to invalidate on disable),
  // so catch it here on every dashboard page load and force a real sign-out.
  const sessionUser = await db.user.findUnique({ where: { id: session.user.id }, select: { disabled: true } })
  if (!sessionUser || sessionUser.disabled) {
    await signOut({ redirectTo: "/login" })
  }

  const actualRole = session.user.role ?? "SALESPERSON"
  const isSuperAdmin = actualRole === "SUPER_ADMIN"

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const [effectiveRole, viewAsUser, viewAsUsers] = await Promise.all([
    getViewAsRole(actualRole),
    getViewAsUser(actualRole),
    isSuperAdmin
      ? db.user.findMany({
          where: { role: { not: "SUPER_ADMIN" }, disabled: false },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  // Sidebar badge counts reflect the previewed person's real data, not the super admin's own
  // (near-empty) leads — that's the whole point of previewing as someone.
  const effectiveUserId = viewAsUser?.id ?? session.user.id

  const [followUpsCount, availableLeadsCount] = await Promise.all([
    db.lead.count({
      where: {
        assignedToId: effectiveUserId,
        followUpAt: { lte: endOfToday },
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
    }).catch(() => 0),
    getAvailableLeadsCount(effectiveUserId, effectiveRole),
  ])

  const effectiveUser = { ...session.user, role: effectiveRole }

  return (
    <DashboardShell
      user={effectiveUser}
      viewingAs={viewAsUser}
      viewAsUsers={viewAsUsers}
      isSuperAdmin={isSuperAdmin}
      counts={{ followUps: followUpsCount, availableLeads: availableLeadsCount }}
    >
      {children}
    </DashboardShell>
  )
}
