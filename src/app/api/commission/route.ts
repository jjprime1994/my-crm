import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { canViewCommission } from "@/lib/app-settings"
import { isMonthStr, parseClaimBody, serializeClaim } from "@/lib/commission"
import { syncOverridingCopy } from "@/lib/commission-overriding"

// POST: add a commission claim row. Body: { kind: "MA"|"LA", userId?, month: "YYYY-MM", ...fields }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })
  if (!(await canViewCommission(session.user.id))) return new NextResponse("Forbidden", { status: 403 })

  const body = await req.json().catch(() => ({}))
  const kind = body.kind
  if (kind !== "MA" && kind !== "LA") return NextResponse.json({ error: "Invalid kind." }, { status: 400 })
  if (!isMonthStr(body.month)) return NextResponse.json({ error: "Invalid month." }, { status: 400 })
  const userId: string = body.userId || session.user.id

  if (!(await canManageUser(session.user.id, session.user.role, userId))) {
    return NextResponse.json({ error: "You can't add claims for this person." }, { status: 403 })
  }

  const parsed = parseClaimBody(kind, body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const row = await db.commissionClaim.create({
    data: {
      ...(parsed.data as object),
      kind,
      userId,
      month: body.month,
      customerName: parsed.data.customerName as string,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  })
  // Sales Commission → blank Sales Overriding copy for the claimant's direct leader
  const sync = await syncOverridingCopy(row, null, session.user.id)
  return NextResponse.json({ ...serializeClaim(row), overriding: sync.copy ? serializeClaim(sync.copy) : null, removedOverridingId: sync.removedId })
}
