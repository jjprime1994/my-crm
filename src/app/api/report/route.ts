import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { canViewCommission } from "@/lib/app-settings"
import { isMonthStr } from "@/lib/commission"
import { parseReportBody, serializeReport } from "@/lib/report"

// POST: add a Sales & Location Report row. Body: { kind: "SALES"|"LOCATION", userId?, month: "YYYY-MM", ...fields }
// Same access rules as MA/LA: yourself or people below you; commission-blocked users can't use it.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })
  if (!(await canViewCommission(session.user.id))) return new NextResponse("Forbidden", { status: 403 })

  const body = await req.json().catch(() => ({}))
  const kind = body.kind
  if (kind !== "SALES" && kind !== "LOCATION") return NextResponse.json({ error: "Invalid kind." }, { status: 400 })
  if (!isMonthStr(body.month)) return NextResponse.json({ error: "Invalid month." }, { status: 400 })
  const userId: string = body.userId || session.user.id

  if (!(await canManageUser(session.user.id, session.user.role, userId))) {
    return NextResponse.json({ error: "You can't add report rows for this person." }, { status: 403 })
  }

  const parsed = parseReportBody(kind, body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const row = await db.performanceReport.create({
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
  return NextResponse.json(serializeReport(row))
}
