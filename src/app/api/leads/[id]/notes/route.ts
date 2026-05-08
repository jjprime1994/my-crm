import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const { content } = await req.json()

  if (!content?.trim()) {
    return new NextResponse("Content is required", { status: 400 })
  }

  const note = await db.leadNote.create({
    data: {
      leadId: id,
      authorId: session.user.id,
      content: content.trim(),
    },
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(note, { status: 201 })
}
