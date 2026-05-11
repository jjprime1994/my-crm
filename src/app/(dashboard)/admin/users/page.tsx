import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import UserManagementClient from "@/components/UserManagementClient"

export default async function UsersPage() {
  const session = await auth()
  if (session?.user.role !== "ADMIN") redirect("/")

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      claimLimit: true,
      createdAt: true,
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return <UserManagementClient users={users} currentUserId={session.user.id} />
}
