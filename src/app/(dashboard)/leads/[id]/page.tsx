import { auth } from "@/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import LeadDetailClient from "@/components/LeadDetailClient"

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session?.user.role
  const adminAccess = role === "ADMIN" || role === "SUPER_ADMIN" || role === "TEAM_LEADER"
  const { id } = await params

  const [leadBase, salespeople, statusHistory, assignmentLogs] = await Promise.all([
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
          where: role === "SUPER_ADMIN"
            ? { role: { in: ["ADMIN", "TEAM_LEADER", "SALESPERSON"] } }
            : role === "ADMIN"
              ? {
                  OR: [
                    { role: "SALESPERSON", managerId: session!.user.id },
                    { role: "SALESPERSON", manager: { managerId: session!.user.id } },
                    { role: "TEAM_LEADER", managerId: session!.user.id },
                  ],
                }
              : { role: "SALESPERSON", managerId: session!.user.id },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.leadStatusHistory
      .findMany({
        where: { leadId: id },
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => []),
    adminAccess
      ? db.leadAssignmentLog.findMany({
          where: { leadId: id },
          include: {
            assignedTo: { select: { name: true } },
            assignedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ])

  if (!leadBase) notFound()

  const lead = { ...leadBase, statusHistory }

  // Salespeople can only view leads assigned to them
  if (!adminAccess && lead.assignedToId !== session?.user.id) notFound()

  return (
    <LeadDetailClient
      lead={lead}
      salespeople={salespeople}
      assignmentLogs={assignmentLogs}
      currentUser={{ id: session!.user.id, role: role }}
    />
  )
}
