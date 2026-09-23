import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { flagUnclaimedAppointments, closeMissedAppointments } from "@/lib/check-appointments"

export const maxDuration = 300

// Daily sweep (Vercel Hobby caps cron at once/day) that flags BOOKED appointment
// slots due today and marks past-due ones MISSED. Same auth pattern as
// check-routing/close-stale-leads: Vercel's cron caller sends
// Authorization: Bearer ${CRON_SECRET}; a logged-in SUPER_ADMIN may also trigger
// it manually by opening the URL.
export async function GET(req: NextRequest) {
  const cronOk =
    !!process.env.CRON_SECRET &&
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`

  if (!cronOk) {
    const session = await auth()
    if (session?.user.role !== "SUPER_ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  const startedAt = Date.now()
  const flagged = await flagUnclaimedAppointments()
  const missed = await closeMissedAppointments()

  return NextResponse.json({
    ok: true,
    flaggedCount: flagged.flaggedCount,
    missedCount: missed.missedCount,
    slotIds: [...flagged.slotIds, ...missed.slotIds],
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  })
}
