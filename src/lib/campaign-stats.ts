import { db } from "@/lib/db"
import { LeadStatus } from "@/generated/prisma/client"

export type CampaignPerformanceRow = {
  name: string
  total: number
  claimed: number
  unclaimed: number
  statusCounts: Record<LeadStatus, number>
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

  // Falls back to adName when campaignName is missing, same as Recent Leads already does
  // (lead.campaignName ?? lead.adName). campaignName comes from a separate Graph API call
  // (ad -> campaign{name}) that needs ads_read permission on top of what fetching the ad
  // itself needs — when that permission is missing/revoked on the access token, every new
  // lead lands with campaignName null despite adName (fetched via a lighter-weight call,
  // with a form-name fallback) still coming through fine. That happened from ~19 Aug 2026
  // onward and made this tab (and the Lead Sources widget) look empty for any date range
  // that fell entirely inside the affected window, even though the leads themselves were
  // never lost — see console logs tagged [meta-webhook] campaign fetch error.
  const campaignLeads = await db.lead.findMany({
    where: { ...dateFilter, OR: [{ campaignName: { not: null } }, { adName: { not: null } }] },
    select: { campaignName: true, adName: true, status: true, assignedToId: true },
  })

  const emptyStatusCounts = (): Record<LeadStatus, number> => ({
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, PROPOSAL: 0, CLOSED_WON: 0, CLOSED_LOST: 0,
  })

  const campaignMap = new Map<string, { total: number; claimed: number; statusCounts: Record<LeadStatus, number> }>()
  for (const lead of campaignLeads) {
    const name = (lead.campaignName ?? lead.adName)!
    if (!campaignMap.has(name)) campaignMap.set(name, { total: 0, claimed: 0, statusCounts: emptyStatusCounts() })
    const entry = campaignMap.get(name)!
    entry.total++
    if (lead.assignedToId) entry.claimed++
    entry.statusCounts[lead.status]++
  }

  const campaigns: CampaignPerformanceRow[] = Array.from(campaignMap.entries())
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
    .sort((a, b) => b.total - a.total)

  return { campaigns }
}
