import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import AvailableLeadsClient from "@/components/AvailableLeadsClient"
import { getAvailableLeads } from "@/lib/available-leads"

export default async function AvailableLeadsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const nextMidnightUTC = new Date(startOfDayInMYT + 24 * 60 * 60 * 1000 - MYT_OFFSET)

  const [leads, user, recentClaims, newLeadsCount] = await Promise.all([
    getAvailableLeads(session.user.id, session.user.role),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { claimLimit: true, newLeadThreshold: true },
    }),
    db.lead.count({
      where: { claimedById: session.user.id, claimedAt: { gte: startOfDayUTC } },
    }),
    db.lead.count({
      where: { assignedToId: session.user.id, status: "NEW" },
    }),
  ])

  const resetAt = nextMidnightUTC.toISOString()
  const threshold = user?.newLeadThreshold ?? 0
  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  return (
    <AvailableLeadsClient
      leads={leads}
      claimLimit={user?.claimLimit ?? 5}
      recentClaims={recentClaims}
      resetAt={resetAt}
      newLeadsCount={newLeadsCount}
      newLeadThreshold={threshold}
      isUnlimited={isSuperAdmin}
    />
  )
}
