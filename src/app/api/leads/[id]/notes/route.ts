import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const admin = isAdmin(session.user.role)

  const lead = await db.lead.findUnique({ where: { id }, select: { assignedToId: true } })
  if (!lead) return new NextResponse("Not found", { status: 404 })
  if (!admin && lead.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  const { content } = await req.json()
  if (!content?.trim()) return new NextResponse("Content is required", { status: 400 })

  const note = await db.leadNote.create({
    data: { leadId: id, authorId: session.user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(note, { status: 201 })
}
