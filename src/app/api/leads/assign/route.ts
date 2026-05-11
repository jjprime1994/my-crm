import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { leadIds, assignedToId } = await req.json()

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return new NextResponse("No leads specified", { status: 400 })
  }

  await db.lead.updateMany({
    where: { id: { in: leadIds } },
    data: { assignedToId: assignedToId || null },
  })

  return NextResponse.json({ updated: leadIds.length })
}
