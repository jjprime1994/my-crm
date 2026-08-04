import { db } from "@/lib/db"

export type CampaignPerformanceRow = {
  name: string
  total: number
  claimed: number
  unclaimed: number
  won: number
  lost: number
  conversion: number
}

export async function getCampaignPerformance(since: Date | null, until: Date | null = null): Promise<{
  campaigns: CampaignPerformanceRow[]
}> {
  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (since) createdAtFilter.gte = since
  if (until) createdAtFilter.lte = until
  const dateFilter = Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}

  const campaignLeads = await db.lead.findMany({
    where: { ...dateFilter, campaignName: { not: null } },
    select: { campaignName: true, status: true, assignedToId: true },
  })

  const campaignMap = new Map<string, { total: number; claimed: number; won: number; lost: number }>()
  for (const lead of campaignLeads) {
    const name = lead.campaignName!
    if (!campaignMap.has(name)) campaignMap.set(name, { total: 0, claimed: 0, won: 0, lost: 0 })
    const entry = campaignMap.get(name)!
    entry.total++
    if (lead.assignedToId) entry.claimed++
    if (lead.status === "CLOSED_WON") entry.won++
    if (lead.status === "CLOSED_LOST") entry.lost++
  }

  const campaigns: CampaignPerformanceRow[] = Array.from(campaignMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      claimed: s.claimed,
      unclaimed: s.total - s.claimed,
      won: s.won,
      lost: s.lost,
      conversion: s.total > 0 ? Math.round((s.won / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return { campaigns }
}
