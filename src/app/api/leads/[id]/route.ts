import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"

async function getOwnedLead(id: string, userId: string, isAdmin: boolean) {
  const lead = await db.lead.findUnique({ where: { id } })
  if (!lead) return null
  if (!isAdmin && lead.assignedToId !== userId) return null
  return lead
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const isAdmin = session.user.role === "ADMIN"

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
  if (!isAdmin && lead.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const isAdmin = session.user.role === "ADMIN"

  // Verify ownership before allowing any update
  const existing = await db.lead.findUnique({ where: { id }, select: { assignedToId: true } })
  if (!existing) return new NextResponse("Not found", { status: 404 })
  if (!isAdmin && existing.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  const body = await req.json()
  const { status, assignedToId } = body

  const data: { status?: LeadStatus; assignedToId?: string | null } = {}

  if (status) data.status = status as LeadStatus

  // Only admins can reassign
  if ("assignedToId" in body) {
    if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })
    data.assignedToId = assignedToId
  }

  const lead = await db.lead.update({ where: { id }, data })
  return NextResponse.json(lead)
}
