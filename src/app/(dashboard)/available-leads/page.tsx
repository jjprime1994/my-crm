import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import AvailableLeadsClient from "@/components/AvailableLeadsClient"

export default async function AvailableLeadsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "ADMIN") redirect("/admin/assign")

  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000)

  const [leads, user, recentClaims, newLeadsCount] = await Promise.all([
    db.lead.findMany({
      where: { assignedToId: null, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { claimLimit: true },
    }),
    db.lead.count({
      where: {
        assignedToId: session.user.id,
        claimedAt: { gte: fifteenMinsAgo },
      },
    }),
    db.lead.count({
      where: { assignedToId: session.user.id, status: "NEW" },
    }),
  ])

  const oldestClaim = recentClaims > 0
    ? await db.lead.findFirst({
        where: { assignedToId: session.user.id, claimedAt: { gte: fifteenMinsAgo } },
        orderBy: { claimedAt: "asc" },
        select: { claimedAt: true },
      })
    : null

  const resetAt = oldestClaim?.claimedAt
    ? new Date(oldestClaim.claimedAt.getTime() + 15 * 60 * 1000).toISOString()
    : null

  return (
    <AvailableLeadsClient
      leads={leads}
      claimLimit={user?.claimLimit ?? 5}
      recentClaims={recentClaims}
      resetAt={resetAt}
      newLeadsCount={newLeadsCount}
    />
  )
}
