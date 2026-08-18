import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { closeStaleUnclaimedLeads } from "@/lib/close-stale-leads"
import { sendPushToSuperAdmins } from "@/lib/push"

export const maxDuration = 300

// Nightly sweep that auto-closes unclaimed leads nobody has touched in 30+ days
// (see vercel.json crons). Same auth pattern as check-routing: Vercel's cron
// caller sends Authorization: Bearer ${CRON_SECRET}; a logged-in SUPER_ADMIN
// may also trigger it manually by opening the URL.
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
  const { closedCount, leadIds } = await closeStaleUnclaimedLeads()

  if (closedCount > 0) {
    await sendPushToSuperAdmins({
      title: "🧹 Stale leads auto-closed",
      body: `${closedCount} unclaimed lead${closedCount !== 1 ? "s" : ""} untouched for 30+ days marked Lost.`,
      url: "/leads",
    })
  }

  return NextResponse.json({
    ok: true,
    closedCount,
    leadIds,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  })
}
