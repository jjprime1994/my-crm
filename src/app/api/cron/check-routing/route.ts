import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkRoutingInvariants } from "@/lib/routing-invariants"
import { sendPushToSuperAdmins } from "@/lib/push"

export const maxDuration = 300

// Nightly routing-invariant check (see vercel.json crons). Vercel's cron caller
// sends Authorization: Bearer ${CRON_SECRET}; a logged-in SUPER_ADMIN may also
// trigger it manually by opening the URL.
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
  const violations = await checkRoutingInvariants()

  if (violations.length > 0) {
    await sendPushToSuperAdmins({
      title: "⚠️ CRM routing check failed",
      body: `${violations.length} violation(s): ${violations[0]}${violations.length > 1 ? " …" : ""}`,
      url: "/superadmin/routing",
    })
  }

  return NextResponse.json({
    ok: violations.length === 0,
    violations,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  })
}
