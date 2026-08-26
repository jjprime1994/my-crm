import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"

export type StatePerformanceRow = {
  name: string
  total: number
  claimed: number
  unclaimed: number
  statusCounts: Record<LeadStatus, number>
  won: number
  lost: number
  conversion: number
}

const NO_STATE_LABEL = "No state"

export async function getStatePerformance(since: Date | null, until: Date | null = null): Promise<{
  states: StatePerformanceRow[]
}> {
  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (since) createdAtFilter.gte = since
  if (until) createdAtFilter.lte = until
  const dateFilter = Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}

  const stateLeads = await db.lead.findMany({
    where: dateFilter,
    select: { branch: true, status: true, assignedToId: true },
  })

  const emptyStatusCounts = (): Record<LeadStatus, number> => ({
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, PROPOSAL: 0, CLOSED_WON: 0, CLOSED_LOST: 0,
  })

  const stateMap = new Map<string, { total: number; claimed: number; statusCounts: Record<LeadStatus, number> }>()
  for (const lead of stateLeads) {
    const name = lead.branch ?? NO_STATE_LABEL
    if (!stateMap.has(name)) stateMap.set(name, { total: 0, claimed: 0, statusCounts: emptyStatusCounts() })
    const entry = stateMap.get(name)!
    entry.total++
    if (lead.assignedToId) entry.claimed++
    entry.statusCounts[lead.status]++
  }

  const states: StatePerformanceRow[] = Array.from(stateMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      claimed: s.claimed,
      unclaimed: s.total - s.claimed,
      statusCounts: s.statusCounts,
      won: s.statusCounts.CLOSED_WON,
      lost: s.statusCounts.CLOSED_LOST,
      conversion: s.total > 0 ? Math.round((s.statusCounts.CLOSED_WON / s.total) * 100) : 0,
    }))
    // "No state" (unresolved branch) sinks to the bottom regardless of volume — it's a data-quality
    // bucket, not a real market, and burying it under legitimate states keeps the ranking meaningful.
    .sort((a, b) => (a.name === NO_STATE_LABEL ? 1 : b.name === NO_STATE_LABEL ? -1 : b.total - a.total))

  return { states }
}
