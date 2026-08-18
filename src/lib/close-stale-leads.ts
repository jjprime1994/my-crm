import { db } from "@/lib/db"

const STALE_DAYS = 30
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000

// Auto-closes leads nobody has claimed and nothing has touched in 30+ days.
// "Unclaimed" = still sitting in the available pool (assignedToId null) —
// leads someone claimed but went quiet on are a different problem (see the
// "Stale" column on Business Overview) and aren't touched here.
export async function closeStaleUnclaimedLeads(): Promise<{ closedCount: number; leadIds: string[] }> {
  const cutoff = new Date(Date.now() - STALE_MS)

  const candidates = await db.lead.findMany({
    where: {
      assignedToId: null,
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, status: true },
  })

  const leadIds: string[] = []
  for (const lead of candidates) {
    await db.lead.update({ where: { id: lead.id }, data: { status: "CLOSED_LOST" } })
    await db.leadStatusHistory.create({
      data: { leadId: lead.id, from: lead.status, to: "CLOSED_LOST", changedById: null },
    })
    await db.leadNote.create({
      data: { leadId: lead.id, authorId: null, content: `Auto-closed as Lost: unclaimed and untouched for ${STALE_DAYS}+ days.` },
    })
    leadIds.push(lead.id)
  }

  return { closedCount: leadIds.length, leadIds }
}
