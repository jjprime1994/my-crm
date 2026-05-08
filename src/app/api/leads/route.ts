import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") as LeadStatus | null
  const assignedToId = searchParams.get("assignedToId")

  const where: Record<string, unknown> = {}

  if (status) where.status = status

  if (session.user.role === "SALESPERSON") {
    where.assignedToId = session.user.id
  } else if (assignedToId) {
    where.assignedToId = assignedToId
  }

  const leads = await db.lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { notes: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(leads)
}
