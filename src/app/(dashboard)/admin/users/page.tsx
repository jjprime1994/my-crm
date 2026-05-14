import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin, isManagerLevel, isTeamLeader } from "@/lib/roles"
import UserManagementClient from "@/components/UserManagementClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function UsersPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isManagerLevel(role)) redirect("/")

  const superAdmin = isSuperAdmin(role)
  const teamLeader = isTeamLeader(role)
  const manager = isAdmin(role) && !superAdmin

  let where: object | undefined
  if (superAdmin) {
    where = undefined
  } else if (manager) {
    // ADMIN sees themselves, their team leaders, and team leaders' salespeople
    where = {
      OR: [
        { id: session!.user.id },
        { managerId: session!.user.id },
        { manager: { managerId: session!.user.id } },
      ],
    }
  } else {
    // TEAM_LEADER sees themselves and their direct reports
    where = { OR: [{ id: session!.user.id }, { managerId: session!.user.id }] }
  }

  const [users, managers] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        claimLimit: true,
        newLeadThreshold: true,
        managerId: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    superAdmin
      ? db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ])

  return (
    <UserManagementClient
      users={users}
      currentUserId={session!.user.id}
      isSuperAdmin={superAdmin}
      isTeamLeader={teamLeader}
      isManager={manager}
      managers={managers}
    />
  )
}
