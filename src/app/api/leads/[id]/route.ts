export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"
import { sendPushToUser } from "@/lib/push"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const admin = isAdmin(session.user.role)

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

  const { id } = await params
  const admin = isAdmin(session.user.role)

  const existing = await db.lead.findUnique({ where: { id }, select: { assignedToId: true } })
  if (!existing) return new NextResponse("Not found", { status: 404 })
  if (!admin && existing.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  const body = await req.json()
  const { status, assignedToId, followUpAt } = body
  const data: { status?: LeadStatus; assignedToId?: string | null; followUpAt?: Date | null } = {}

  if (status) data.status = status as LeadStatus
  if ("followUpAt" in body) data.followUpAt = followUpAt ? new Date(followUpAt) : null

  if ("assignedToId" in body) {
    if (!admin) return new NextResponse("Forbidden", { status: 403 })
    data.assignedToId = assignedToId
  }

  const lead = await db.lead.update({ where: { id }, data, include: { assignedTo: { select: { name: true } } } })

  // Notify salesperson when a lead is assigned to them
  if ("assignedToId" in body && data.assignedToId && data.assignedToId !== existing.assignedToId) {
    sendPushToUser(data.assignedToId, {
      title: "New lead assigned to you",
      body: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "A new lead",
      url: `/leads/${id}`,
    }).catch(() => {})
  }

  return NextResponse.json(lead)
}
