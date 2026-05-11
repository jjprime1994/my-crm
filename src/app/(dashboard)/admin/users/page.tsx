import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin } from "@/lib/roles"
import UserManagementClient from "@/components/UserManagementClient"

export default async function UsersPage() {
  const session = await auth()
  if (!isAdmin(session?.user.role)) redirect("/")

  const superAdmin = isSuperAdmin(session?.user.role)

  const [users, managers] = await Promise.all([
    db.user.findMany({
      where: superAdmin
        ? undefined
        : { OR: [{ id: session!.user.id }, { managerId: session!.user.id }] },
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
      ? db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ])

  return (
    <UserManagementClient
      users={users}
      currentUserId={session!.user.id}
      isSuperAdmin={superAdmin}
      managers={managers}
    />
  )
}
