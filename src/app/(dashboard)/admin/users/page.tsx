import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"
import UserManagementClient from "@/components/UserManagementClient"

export default async function UsersPage() {
  const session = await auth()
  if (!isAdmin(session?.user.role)) redirect("/")

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      claimLimit: true,
      maxNewLeads: true,
      createdAt: true,
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return <UserManagementClient users={users} currentUserId={session.user.id} currentUserRole={session.user.role} />
}
