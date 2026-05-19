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

  const [rawLeads, salespeople] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        adName: true, campaignName: true, branch: true, source: true,
        isDuplicate: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { role: "SALESPERSON" },
      select: {
        id: true, name: true,
        _count: { select: { leads: true } },
        leads: { where: { status: "NEW" }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  // For each duplicate lead, find the sibling lead with the same phone so managers know what they're looking at
  const dupPhones = rawLeads.filter((l) => l.isDuplicate && l.phone).map((l) => l.phone!)
  const siblings = dupPhones.length > 0
    ? await db.lead.findMany({
        where: { phone: { in: dupPhones }, isDuplicate: false },
        select: {
          id: true, phone: true,
          campaignName: true, adName: true, status: true,
          assignedTo: { select: { name: true } },
        },
      })
    : []

  // Build phone → sibling map
  const siblingByPhone = Object.fromEntries(siblings.map((s) => [s.phone!, s]))

  const leads = rawLeads.map((l) => ({
    ...l,
    dupSibling: l.isDuplicate && l.phone ? (siblingByPhone[l.phone] ?? null) : null,
  }))

  return <BulkAssignClient leads={leads} salespeople={salespeople} />
}
