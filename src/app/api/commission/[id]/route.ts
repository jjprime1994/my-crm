import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { canViewCommission } from "@/lib/app-settings"
import { isMonthStr, parseClaimBody, serializeClaim } from "@/lib/commission"
import { needsOverridingCopy, syncOverridingCopy } from "@/lib/commission-overriding"

async function loadEditable(id: string) {
  const session = await auth()
  if (!session) return { error: new NextResponse("Unauthorized", { status: 401 }) }
  if (await isUserDisabled(session.user.id)) return { error: new NextResponse("Account disabled", { status: 403 }) }
  if (!(await canViewCommission(session.user.id))) return { error: new NextResponse("Forbidden", { status: 403 }) }
  const claim = await db.commissionClaim.findUnique({ where: { id } })
  if (!claim) return { error: NextResponse.json({ error: "Claim not found." }, { status: 404 }) }
  if (!(await canManageUser(session.user.id, session.user.role, claim.userId))) {
    return { error: NextResponse.json({ error: "You can't edit this claim." }, { status: 403 }) }
  }
  return { session, claim }
}

// PATCH: replace the editable fields of a claim row (same body shape as POST).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadEditable(id)
  if (r.error) return r.error
  const { session, claim } = r

  const body = await req.json().catch(() => ({}))
  const parsed = parseClaimBody(claim.kind, body, !!claim.sourceClaimId)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const month = isMonthStr(body.month) ? body.month : claim.month
  const updated = await db.commissionClaim.update({
    where: { id },
    data: { ...(parsed.data as object), month, updatedById: session.user.id },
  })
  const sync = await syncOverridingCopy(updated, needsOverridingCopy(claim), session.user.id)
  return NextResponse.json({ ...serializeClaim(updated), overriding: sync.copy ? serializeClaim(sync.copy) : null, removedOverridingId: sync.removedId })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadEditable(id)
  if (r.error) return r.error
  // The leader's overriding copy (if any) goes with it via the FK cascade
  const copy = await db.commissionClaim.findUnique({ where: { sourceClaimId: id }, select: { id: true } })
  await db.commissionClaim.delete({ where: { id } })
  return NextResponse.json({ ok: true, removedOverridingId: copy?.id ?? null })
}
