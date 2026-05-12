import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin } from "@/lib/roles"
import BulkAssignClient from "@/components/BulkAssignClient"

export default async function AssignPage() {
  const session = await auth()
  if (!isSuperAdmin(session?.user.role)) redirect("/")

  const superAdmin = isSuperAdmin(session?.user.role)

  const [leads, salespeople] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: superAdmin
        ? { role: "SALESPERSON" }
        : { role: "SALESPERSON", managerId: session!.user.id },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  return <BulkAssignClient leads={leads} salespeople={salespeople} />
}
