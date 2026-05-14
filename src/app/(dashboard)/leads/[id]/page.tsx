import { auth } from "@/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import LeadDetailClient from "@/components/LeadDetailClient"

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session?.user.role
  const adminAccess = role === "ADMIN" || role === "SUPER_ADMIN" || role === "TEAM_LEADER"
  const { id } = await params

  const [leadBase, salespeople] = await Promise.all([
    db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    adminAccess
      ? db.user.findMany({
          where: role === "ADMIN"
            ? { role: "SALESPERSON", managerId: session!.user.id }
            : { role: "SALESPERSON" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  if (!leadBase) notFound()

  const statusHistory = await db.leadStatusHistory
    .findMany({
      where: { leadId: id },
      include: { changedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => [])

  const lead = { ...leadBase, statusHistory }

  // Salespeople can only view leads assigned to them
  if (!adminAccess && lead.assignedToId !== session?.user.id) notFound()

  return (
    <LeadDetailClient
      lead={lead}
      salespeople={salespeople}
      currentUser={{ id: session!.user.id, role: role }}
    />
  )
}
