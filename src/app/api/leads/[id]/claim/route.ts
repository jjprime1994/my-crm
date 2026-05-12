import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) return new NextResponse("User not found", { status: 404 })

  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  if (!isSuperAdmin && user.newLeadThreshold > 0) {
    const newLeadsCount = await db.lead.count({
      where: { assignedToId: session.user.id, status: "NEW" },
    })
    if (newLeadsCount >= user.newLeadThreshold) {
      return NextResponse.json(
        { error: `You have ${newLeadsCount} uncontacted lead${newLeadsCount > 1 ? "s" : ""}. Contact them before claiming more.` },
        { status: 403 }
      )
    }
  }

  if (isSuperAdmin) {
    const lead = await db.lead.update({ where: { id, assignedToId: null }, data: { assignedToId: session.user.id, claimedAt: new Date() } }).catch(() => null)
    if (!lead) return NextResponse.json({ error: "This lead has already been claimed." }, { status: 409 })
    return NextResponse.json(lead)
  }

  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000)
  const recentClaims = await db.lead.count({
    where: { assignedToId: session.user.id, claimedAt: { gte: fifteenMinsAgo } },
  })

  if (recentClaims >= user.claimLimit) {
    const oldest = await db.lead.findFirst({
      where: { assignedToId: session.user.id, claimedAt: { gte: fifteenMinsAgo } },
      orderBy: { claimedAt: "asc" },
    })
    const resetAt = new Date(oldest!.claimedAt!.getTime() + 15 * 60 * 1000)
    const secondsLeft = Math.ceil((resetAt.getTime() - Date.now()) / 1000)
    return NextResponse.json(
      { error: `Claim limit reached (${user.claimLimit} per 15 min). Try again in ${Math.ceil(secondsLeft / 60)}m ${secondsLeft % 60}s.` },
      { status: 429 }
    )
  }

  try {
    const lead = await db.lead.update({
      where: { id, assignedToId: null },
      data: { assignedToId: session.user.id, claimedAt: new Date() },
    })
    return NextResponse.json(lead)
  } catch {
    return NextResponse.json({ error: "This lead has already been claimed." }, { status: 409 })
  }
}
