import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin, isManagerLevel, isTeamLeader } from "@/lib/roles"
import UserManagementClient from "@/components/UserManagementClient"
import TeamAdAccessClient from "@/components/TeamAdAccessClient"
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

  const [users, managers, myCoveredStates, activeAdRoutes, allSalesRoster] = await Promise.all([
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
      ? db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN", "TEAM_LEADER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    manager || superAdmin
      ? db.user.findUnique({ where: { id: session!.user.id }, select: { coveredStates: true } })
      : Promise.resolve(null),
    manager || superAdmin
      ? db.adRoute.findMany({ where: { archived: false }, select: { adName: true, adId: true, userIds: true, userStates: true }, orderBy: { adName: "asc" } })
      : Promise.resolve([]),
    // Super admin isn't scoped by `where` above (they already load everyone), but the
    // panel needs the full salesperson/team-leader roster regardless of team.
    superAdmin
      ? db.user.findMany({ where: { role: { in: ["SALESPERSON", "TEAM_LEADER"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <UserManagementClient
        users={users}
        currentUserId={session!.user.id}
        isSuperAdmin={superAdmin}
        isTeamLeader={teamLeader}
        isManager={manager}
        managers={managers}
      />
      {(manager || superAdmin) && (
        <TeamAdAccessClient
          ads={activeAdRoutes.map((r) => ({
            adName: r.adName,
            adId: r.adId,
            userIds: r.userIds,
            userStates: (r.userStates as Record<string, string[]>) ?? {},
          }))}
          teamMembers={
            superAdmin
              ? allSalesRoster
              : users.filter((u) => u.id !== session!.user.id && (u.role === "SALESPERSON" || u.role === "TEAM_LEADER"))
          }
          myCoveredStates={myCoveredStates?.coveredStates ?? []}
        />
      )}
    </div>
  )
}
