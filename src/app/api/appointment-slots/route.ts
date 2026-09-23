import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const slots = await db.appointmentSlot.findMany({
    select: {
      id: true, branch: true, startAt: true, endAt: true, status: true,
      claimedById: true, claimedAt: true, claimedBy: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { startAt: "desc" },
  })

  return NextResponse.json(slots)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { branch, startAt, endAt } = await req.json()
  if (!branch || !startAt || !endAt) return new NextResponse("branch, startAt, and endAt are required", { status: 400 })

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return new NextResponse("Invalid startAt/endAt", { status: 400 })
  }

  const slot = await db.appointmentSlot.create({
    data: { branch, startAt: start, endAt: end, status: "OPEN", createdByAdminId: session.user.id },
  })

  return NextResponse.json(slot, { status: 201 })
}
