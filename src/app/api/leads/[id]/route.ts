export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"
import { isUserDisabled } from "@/lib/session-guard"
import { LeadStatus } from "@/generated/prisma/client"
import { sendPushToUser } from "@/lib/push"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })

  const { id } = await params
  const admin = isManagerLevel(session.user.role)

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!lead) return new NextResponse("Not found", { status: 404 })
  if (!admin && lead.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })

  const { id } = await params
  const admin = isManagerLevel(session.user.role)

  const existing = await db.lead.findUnique({ where: { id }, select: { assignedToId: true, status: true } })
  if (!existing) return new NextResponse("Not found", { status: 404 })
  if (!admin && existing.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  const body = await req.json()
  const { status, assignedToId, followUpAt } = body
  const data: { status?: LeadStatus; assignedToId?: string | null; followUpAt?: Date | null } = {}

  const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"]
  if (status) {
    if (!VALID_STATUSES.includes(status)) return new NextResponse("Invalid status", { status: 400 })
    data.status = status as LeadStatus
  }
  if ("followUpAt" in body) data.followUpAt = followUpAt ? new Date(followUpAt) : null

  if ("assignedToId" in body) {
    if (!admin) return new NextResponse("Forbidden", { status: 403 })
    data.assignedToId = assignedToId
  }

  const lead = await db.lead.update({ where: { id }, data, include: { assignedTo: { select: { name: true } } } })

  // Record status change history
  if (status && status !== existing.status) {
    await db.leadStatusHistory.create({
      data: {
        leadId: id,
        from: existing.status,
        to: status as LeadStatus,
        changedById: session.user.id,
      },
    }).catch((e) => console.error("Failed to write status history:", e))

    if (status === "CONTACTED") {
      await db.lead.updateMany({
        where: { id, firstContactedAt: null },
        data: { firstContactedAt: new Date() },
      }).catch((e) => console.error("Failed to set firstContactedAt:", e))
    }
  }

  // Record assignment change and notify salesperson
  const assignmentChanged = "assignedToId" in body && data.assignedToId !== existing.assignedToId
  if (assignmentChanged) {
    await db.leadAssignmentLog.create({
      data: {
        leadId: id,
        assignedToId: data.assignedToId ?? null,
        assignedById: session.user.id,
        source: "SINGLE_ASSIGN",
      },
    }).catch((e) => console.error("Failed to write assignment log:", e))

    if (data.assignedToId) {
      sendPushToUser(data.assignedToId, {
        title: "New lead assigned to you",
        body: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "A new lead",
        url: `/leads/${id}`,
      }).catch(() => {})
    }
  }

  return NextResponse.json(lead)
}
