import { db } from "@/lib/db"

export type CampaignEntry = { campaignId: string; campaignName: string | null; nameFromAd: boolean; excluded: boolean }

// All known campaigns (from leads) merged with manually-added/excluded ones, for
// /superadmin/excluded-campaigns and its API.
//
// Name resolution per campaignId, best first:
//   1. any lead's campaignName (not an arbitrary lead's — leads from the 19–26 Aug 2026
//      Meta token outage have campaignName null, and a bare `distinct` could pick one)
//   2. the name typed in when the campaign was excluded by ID
//   3. the most recent lead's adName (same fallback Campaign Performance uses), flagged
//      nameFromAd so the UI can show it isn't the real campaign name
export async function getCampaignEntries(): Promise<CampaignEntry[]> {
  const [named, allIds, excluded] = await Promise.all([
    db.lead.findMany({
      where: { campaignId: { not: null }, campaignName: { not: null } },
      select: { campaignId: true, campaignName: true },
      distinct: ["campaignId"],
      orderBy: [{ campaignId: "asc" }, { createdAt: "desc" }],
    }),
    db.lead.findMany({
      where: { campaignId: { not: null } },
      select: { campaignId: true, adName: true },
      distinct: ["campaignId"],
      orderBy: [{ campaignId: "asc" }, { createdAt: "desc" }],
    }),
    db.excludedCampaign.findMany().catch(() => []),
  ])

  const nameFromLeads = new Map(named.map((c) => [c.campaignId!, c.campaignName!]))
  const adNameById = new Map(allIds.map((c) => [c.campaignId!, c.adName]))
  const excludedById = new Map(excluded.map((e) => [e.campaignId, e.campaignName]))

  const ids = new Set([...allIds.map((c) => c.campaignId!), ...excludedById.keys()])

  const entries: CampaignEntry[] = Array.from(ids, (campaignId) => {
    const real = nameFromLeads.get(campaignId) ?? excludedById.get(campaignId) ?? null
    const ad = real ? null : (adNameById.get(campaignId) ?? null)
    return { campaignId, campaignName: real ?? ad, nameFromAd: !real && !!ad, excluded: excludedById.has(campaignId) }
  })

  return entries.sort((a, b) => (a.campaignName ?? a.campaignId).localeCompare(b.campaignName ?? b.campaignId))
}
