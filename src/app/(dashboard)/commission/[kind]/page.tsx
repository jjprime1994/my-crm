import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"
import { getScopedUsers } from "@/lib/team-scope"
import { currentMonthMYT, isMonthStr, serializeClaim } from "@/lib/commission"
import CommissionClient from "@/components/CommissionClient"

// /commission/ma → Sales commission, /commission/la → Location commission
export default async function CommissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const [{ kind: kindParam }, sp] = await Promise.all([params, searchParams])
  const kind = kindParam.toUpperCase()
  if (kind !== "MA" && kind !== "LA") notFound()

  const [role, viewAsUser] = await Promise.all([getViewAsRole(session.user.role), getViewAsUser(session.user.role)])
  const me = viewAsUser?.id ?? session.user.id
  const month = isMonthStr(sp.month) ? sp.month : currentMonthMYT()

  const users = await getScopedUsers(me, role)
  const claims = await db.commissionClaim.findMany({
    where: { kind, month, userId: { in: users.map((u) => u.id) } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <CommissionClient
      key={`${me}-${kind}-${month}`}
      kind={kind}
      month={month}
      meId={me}
      canExport={role === "SUPER_ADMIN"}
      showTeams={role === "SUPER_ADMIN"}
      users={users.map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabled, teamId: u.teamId, teamLabel: u.teamLabel }))}
      claims={claims.map(serializeClaim)}
    />
  )
}
