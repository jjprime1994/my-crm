import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

// PATCH: cancel an OPEN slot. Never hard-deletes — CANCELLED preserves history like leads do.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { id } = await params
  const { status } = await req.json()
  if (status !== "CANCELLED") return new NextResponse("Only cancelling is supported here.", { status: 400 })

  const slot = await db.appointmentSlot.update({
    where: { id, status: "OPEN" },
    data: { status: "CANCELLED" },
  }).catch(() => null)

  if (!slot) return NextResponse.json({ error: "Only an OPEN (unbooked) slot can be cancelled." }, { status: 409 })
  return NextResponse.json(slot)
}
