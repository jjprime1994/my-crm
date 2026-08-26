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
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    adminAccess
      ? db.user.findMany({
          where: {
            disabled: false,
            ...(role === "SUPER_ADMIN"
              ? { role: { in: ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER", "SALESPERSON"] } }
              : role === "ADMIN"
                ? {
                    OR: [
                      { role: "SALESPERSON", managerId: session!.user.id },
                      { role: "SALESPERSON", manager: { managerId: session!.user.id } },
                      { role: "TEAM_LEADER", managerId: session!.user.id },
                    ],
                  }
                : { role: "SALESPERSON", managerId: session!.user.id }),
          },
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

  // The dropdown's base list is scoped to "who this viewer may assign new leads to" — a
  // permission question. Whoever the lead is ALREADY assigned to is a different question
  // (just "what's true right now") and must always be selectable regardless of scope, or
  // the <select> has no matching <option>, silently renders as "Unassigned" even though
  // nothing changed, and the Save button — gated on the value actually differing from the
  // lead's real assignedToId — never appears. Hit this for any lead assigned to someone
  // outside the viewer's direct scope: another team's Team Leader/Manager, a Super Admin,
  // or the viewer's own self-assigned lead (their own id is never in their own subordinate
  // list). Affected ~1,418 active leads in production before this fix (self/cross-team
  // Team Leader and Manager assignments), not just the Super Admin case fixed earlier.
  const assigneeOptions = lead.assignedTo && !salespeople.some((s) => s.id === lead.assignedTo!.id)
    ? [...salespeople, { id: lead.assignedTo.id, name: lead.assignedTo.name, role: lead.assignedTo.role }]
    : salespeople

  const dupSibling = lead.isDuplicate && lead.phone
    ? await db.lead.findFirst({
        where: { phone: lead.phone, isDuplicate: false },
        select: {
          campaignName: true,
          createdAt: true,
          status: true,
          assignedTo: { select: { name: true } },
        },
      })
    : null

  return (
    <LeadDetailClient
      lead={{ ...lead, dupSibling }}
      salespeople={assigneeOptions}
      assignmentLogs={assignmentLogs}
      currentUser={{ id: session!.user.id, role: role }}
    />
  )
}
