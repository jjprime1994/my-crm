import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"
import { isUserDisabled } from "@/lib/session-guard"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })

  const { id } = await params
  const admin = isManagerLevel(session.user.role)

  const lead = await db.lead.findUnique({ where: { id }, select: { assignedToId: true, status: true } })
  if (!lead) return new NextResponse("Not found", { status: 404 })
  if (!admin && lead.assignedToId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })

  const { content } = await req.json()
  if (!content?.trim()) return new NextResponse("Content is required", { status: 400 })
  const trimmed = content.trim()

  const note = await db.leadNote.create({
    data: { leadId: id, authorId: session.user.id, content: trimmed },
    include: { author: { select: { id: true, name: true } } },
  })

  // Record first contact time when salesperson logs a contact attempt
  if (trimmed.startsWith("Contacted via")) {
    db.lead.updateMany({
      where: { id, firstContactedAt: null },
      data: { firstContactedAt: new Date() },
    }).catch(() => {})
  }

  // Reaching out via WhatsApp or a call is a real contact attempt, not just a note —
  // advance a fresh lead out of New automatically so it doesn't sit uncounted as
  // "not contacted" after the salesperson has, in fact, contacted them. Email is left
  // alone since it's asynchronous and easy to fire off without any real engagement.
  let newStatus: string | null = null
  if (lead.status === "NEW" && (trimmed === "Contacted via WhatsApp" || trimmed === "Contacted via phone call")) {
    await db.lead.update({ where: { id }, data: { status: "CONTACTED" } })
    await db.leadStatusHistory.create({
      data: { leadId: id, from: "NEW", to: "CONTACTED", changedById: session.user.id },
    }).catch((e) => console.error("Failed to write status history:", e))
    newStatus = "CONTACTED"
  }

  return NextResponse.json({ note, newStatus }, { status: 201 })
}
