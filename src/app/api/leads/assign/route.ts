import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { sendPushToUser } from "@/lib/push"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { leadIds, assignedToId } = await req.json()

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return new NextResponse("No leads specified", { status: 400 })
  }

  if (assignedToId) {
    const target = await db.user.findUnique({ where: { id: assignedToId }, select: { id: true } })
    if (!target) return new NextResponse("Assignee not found", { status: 400 })
  }

  await db.$transaction([
    db.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { assignedToId: assignedToId || null },
    }),
    db.leadAssignmentLog.createMany({
      data: leadIds.map((leadId: string) => ({
        leadId,
        assignedToId: assignedToId || null,
        assignedById: session.user.id,
        source: "BULK_ASSIGN",
      })),
    }),
  ])

  // Notify the assignee
  if (assignedToId) {
    const leads = await db.lead.findMany({
      where: { id: { in: leadIds } },
      select: { firstName: true, lastName: true },
    })
    const count = leads.length
    const title = count === 1
      ? `New lead assigned to you`
      : `${count} leads assigned to you`
    const firstName = leads[0]?.firstName ?? "A lead"
    const body = count === 1
      ? `${firstName}${leads[0]?.lastName ? " " + leads[0].lastName : ""} has been assigned to you`
      : `${firstName} and ${count - 1} other${count - 1 !== 1 ? "s" : ""} have been assigned to you`
    await sendPushToUser(assignedToId, { title, body, url: "/leads" })
  }

  return NextResponse.json({ updated: leadIds.length })
}
