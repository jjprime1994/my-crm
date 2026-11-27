import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"
import { getScopedUsers } from "@/lib/team-scope"
import { currentMonthMYT, isMonthStr } from "@/lib/commission"
import { serializeReport } from "@/lib/report"
import ReportClient from "@/components/ReportClient"
import { getCommissionBlockedIds } from "@/lib/app-settings"

// /report — monthly Sales & Location Report (same access rules as MA/LA).
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const sp = await searchParams
  const [role, viewAsUser] = await Promise.all([getViewAsRole(session.user.role), getViewAsUser(session.user.role)])
  const me = viewAsUser?.id ?? session.user.id
  const blocked = await getCommissionBlockedIds()
  if (blocked.includes(session.user.id) || blocked.includes(me)) notFound()
  const month = isMonthStr(sp.month) ? sp.month : currentMonthMYT()

  const users = await getScopedUsers(me, role)
  const rows = await db.performanceReport.findMany({
    where: { month, userId: { in: users.map((u) => u.id) } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <ReportClient
      key={`${me}-${month}`}
      month={month}
      meId={me}
      canExport={role === "SUPER_ADMIN"}
      showTeams={role === "SUPER_ADMIN"}
      users={users.map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabled, managerId: u.managerId, teamId: u.teamId, teamLabel: u.teamLabel }))}
      rows={rows.map(serializeReport)}
    />
  )
}
