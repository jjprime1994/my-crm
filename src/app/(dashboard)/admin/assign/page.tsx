import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import BulkAssignClient from "@/components/BulkAssignClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function AssignPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const [leads, salespeople] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { role: "SALESPERSON" },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  return <BulkAssignClient leads={leads} salespeople={salespeople} />
}
