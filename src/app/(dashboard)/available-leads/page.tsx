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

  const [rawLeads, user, recentClaims, newLeadsCount] = await Promise.all([
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

  // Mark leads where the same phone/email has been claimed before
  const phones = rawLeads.filter((l) => l.phone).map((l) => l.phone!)
  const emails = rawLeads.filter((l) => l.email).map((l) => l.email!)
  const claimedContacts = (phones.length > 0 || emails.length > 0)
    ? await db.lead.findMany({
        where: {
          claimedAt: { not: null },
          OR: [
            ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
            ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ],
        },
        select: { phone: true, email: true },
      })
    : []
  const claimedPhones = new Set(claimedContacts.map((l) => l.phone).filter(Boolean))
  const claimedEmails = new Set(claimedContacts.map((l) => l.email).filter(Boolean))

  // Fetch sibling leads for dup leads so we can show why they're flagged
  const dupPhones = [...new Set(rawLeads.filter((l) => l.isDuplicate && l.phone).map((l) => l.phone!))]
  const dupSiblings = dupPhones.length > 0
    ? await db.lead.findMany({
        where: { phone: { in: dupPhones }, isDuplicate: false },
        select: { phone: true, campaignName: true, createdAt: true, status: true, assignedTo: { select: { name: true } } },
      })
    : []
  const siblingByPhone = Object.fromEntries(dupSiblings.map((s) => [s.phone!, s]))

  const leads = rawLeads.map((l) => ({
    ...l,
    claimedBefore: !!(
      (l.phone && claimedPhones.has(l.phone)) ||
      (l.email && claimedEmails.has(l.email))
    ),
    dupSibling: l.isDuplicate && l.phone ? (siblingByPhone[l.phone] ?? null) : null,
  }))

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
