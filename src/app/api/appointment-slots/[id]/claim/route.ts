import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAppointmentClaimableBy } from "@/lib/available-appointments"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) return new NextResponse("User not found", { status: 404 })
  if (user.disabled) return new NextResponse("Account disabled", { status: 403 })

  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  // Pool visibility check — same principle as lead claiming: an appointment slot is only
  // claimable if it would appear in this user's Available Appointments pool, even if the
  // slot ID is known directly.
  if (!isSuperAdmin) {
    const slot = await db.appointmentSlot.findUnique({ where: { id }, select: { branch: true, status: true } })
    if (!slot) return NextResponse.json({ error: "Appointment not found." }, { status: 404 })
    if (slot.status !== "BOOKED") return NextResponse.json({ error: "This appointment has already been claimed or is no longer available." }, { status: 409 })
    if (!(await isAppointmentClaimableBy(session.user.id, session.user.role, slot))) {
      return NextResponse.json({ error: "This appointment is not in your team's claim pool." }, { status: 403 })
    }
  }

  if (isSuperAdmin) {
    const slot = await db.appointmentSlot.update({
      where: { id, status: "BOOKED" },
      data: { status: "CLAIMED", claimedById: session.user.id, claimedAt: new Date() },
    }).catch(() => null)
    if (!slot) return NextResponse.json({ error: "This appointment has already been claimed." }, { status: 409 })
    return NextResponse.json(slot)
  }

  // Separate daily quota from lead claimLimit — same midnight-MYT-reset window.
  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const nextMidnightUTC = new Date(startOfDayInMYT + 24 * 60 * 60 * 1000 - MYT_OFFSET)

  const todayClaims = await db.appointmentSlot.count({
    where: { claimedById: session.user.id, claimedAt: { gte: startOfDayUTC } },
  })

  if (todayClaims >= user.appointmentClaimLimit) {
    const secondsLeft = Math.ceil((nextMidnightUTC.getTime() - nowMs) / 1000)
    const hoursLeft = Math.floor(secondsLeft / 3600)
    const minsLeft = Math.floor((secondsLeft % 3600) / 60)
    return NextResponse.json(
      { error: `Appointment claim limit reached (${user.appointmentClaimLimit}/day). Resets at midnight MYT (in ${hoursLeft}h ${minsLeft}m).` },
      { status: 429 }
    )
  }

  let slot: Awaited<ReturnType<typeof db.appointmentSlot.update>>
  try {
    slot = await db.$transaction(async (tx) => {
      const claimed = await tx.appointmentSlot.update({
        where: { id, status: "BOOKED" },
        data: { status: "CLAIMED", claimedById: session.user.id, claimedAt: new Date() },
      })
      const countAfter = await tx.appointmentSlot.count({
        where: { claimedById: session.user.id, claimedAt: { gte: startOfDayUTC } },
      })
      if (countAfter > user.appointmentClaimLimit) throw new Error("LIMIT_EXCEEDED")
      return claimed
    })
  } catch (e) {
    if (e instanceof Error && e.message === "LIMIT_EXCEEDED") {
      const secondsLeft = Math.ceil((nextMidnightUTC.getTime() - nowMs) / 1000)
      const hoursLeft = Math.floor(secondsLeft / 3600)
      const minsLeft = Math.floor((secondsLeft % 3600) / 60)
      return NextResponse.json(
        { error: `Appointment claim limit reached (${user.appointmentClaimLimit}/day). Resets at midnight MYT (in ${hoursLeft}h ${minsLeft}m).` },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "This appointment has already been claimed." }, { status: 409 })
  }

  return NextResponse.json(slot)
}
