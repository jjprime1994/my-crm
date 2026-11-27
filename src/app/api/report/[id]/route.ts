import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { canViewCommission } from "@/lib/app-settings"
import { parseReportBody, serializeReport } from "@/lib/report"

async function loadEditable(id: string) {
  const session = await auth()
  if (!session) return { error: new NextResponse("Unauthorized", { status: 401 }) }
  if (await isUserDisabled(session.user.id)) return { error: new NextResponse("Account disabled", { status: 403 }) }
  if (!(await canViewCommission(session.user.id))) return { error: new NextResponse("Forbidden", { status: 403 }) }
  const row = await db.performanceReport.findUnique({ where: { id } })
  if (!row) return { error: NextResponse.json({ error: "Row not found." }, { status: 404 }) }
  if (!(await canManageUser(session.user.id, session.user.role, row.userId))) {
    return { error: NextResponse.json({ error: "You can't edit this row." }, { status: 403 }) }
  }
  return { session, row }
}

// PATCH: replace the editable fields of a report row (same body shape as POST; kind/month/person stay).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadEditable(id)
  if (r.error) return r.error
  const body = await req.json().catch(() => ({}))
  const parsed = parseReportBody(r.row.kind, body, r.row.locationType)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const updated = await db.performanceReport.update({
    where: { id },
    data: { ...(parsed.data as object), updatedById: r.session.user.id },
  })
  return NextResponse.json(serializeReport(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadEditable(id)
  if (r.error) return r.error
  await db.performanceReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
