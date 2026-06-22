import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"
import { getEffectiveAdmin } from "@/lib/available-leads"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) return new NextResponse("User not found", { status: 404 })

  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  // State coverage check — enforce team boundary even if the lead URL is known directly
  if (!isSuperAdmin) {
    const [lead, effectiveAdmin] = await Promise.all([
      db.lead.findUnique({ where: { id }, select: { branch: true, assignedToId: true } }),
      getEffectiveAdmin(session.user.id, session.user.role),
    ])
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 })
    if (lead.assignedToId !== null) return NextResponse.json({ error: "This lead has already been claimed." }, { status: 409 })
    if (
      effectiveAdmin &&
      effectiveAdmin.coveredStates.length > 0 &&
      lead.branch !== null &&
      !effectiveAdmin.coveredStates.includes(lead.branch)
    ) {
      return NextResponse.json({ error: "This lead is outside your team's covered states." }, { status: 403 })
    }
  }

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
    const lead = await db.lead.update({ where: { id, assignedToId: null }, data: { assignedToId: session.user.id, claimedById: session.user.id, claimedAt: new Date() } }).catch(() => null)
    if (!lead) return NextResponse.json({ error: "This lead has already been claimed." }, { status: 409 })
    return NextResponse.json(lead)
  }

  // Daily window resetting at midnight MYT (UTC+8)
  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const nextMidnightUTC = new Date(startOfDayInMYT + 24 * 60 * 60 * 1000 - MYT_OFFSET)

  // Pre-check for fast rejection with a helpful message
  const todayClaims = await db.lead.count({
    where: { claimedById: session.user.id, claimedAt: { gte: startOfDayUTC } },
  })

  if (todayClaims >= user.claimLimit) {
    const secondsLeft = Math.ceil((nextMidnightUTC.getTime() - nowMs) / 1000)
    const hoursLeft = Math.floor(secondsLeft / 3600)
    const minsLeft = Math.floor((secondsLeft % 3600) / 60)
    return NextResponse.json(
      { error: `Claim limit reached (${user.claimLimit}/day). Resets at midnight MYT (in ${hoursLeft}h ${minsLeft}m).` },
      { status: 429 }
    )
  }

  // Claim then re-count inside a transaction — if concurrent requests both passed the pre-check,
  // the post-claim count will catch the overage and roll back via throw.
  let lead: Awaited<ReturnType<typeof db.lead.update>>
  try {
    lead = await db.$transaction(async (tx) => {
      const claimed = await tx.lead.update({
        where: { id, assignedToId: null },
        data: { assignedToId: session.user.id, claimedById: session.user.id, claimedAt: new Date() },
      })
      const countAfter = await tx.lead.count({
        where: { claimedById: session.user.id, claimedAt: { gte: startOfDayUTC } },
      })
      if (countAfter > user.claimLimit) throw new Error("LIMIT_EXCEEDED")
      return claimed
    })
  } catch (e) {
    if (e instanceof Error && e.message === "LIMIT_EXCEEDED") {
      const secondsLeft = Math.ceil((nextMidnightUTC.getTime() - nowMs) / 1000)
      const hoursLeft = Math.floor(secondsLeft / 3600)
      const minsLeft = Math.floor((secondsLeft % 3600) / 60)
      return NextResponse.json(
        { error: `Claim limit reached (${user.claimLimit}/day). Resets at midnight MYT (in ${hoursLeft}h ${minsLeft}m).` },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "This lead has already been claimed." }, { status: 409 })
  }

  return NextResponse.json(lead)
}
