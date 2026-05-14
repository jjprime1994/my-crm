export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (!isManagerLevel(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { id } = await params
  const { status } = await req.json()

  if (!VALID_STATUSES.includes(status)) {
    return new NextResponse("Invalid status", { status: 400 })
  }

  const suggestion = await db.suggestion.update({
    where: { id },
    data: { status },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(suggestion)
}
