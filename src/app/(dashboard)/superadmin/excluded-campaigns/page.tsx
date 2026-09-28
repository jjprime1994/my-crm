import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import ExcludedCampaignsClient from "@/components/ExcludedCampaignsClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function ExcludedCampaignsPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const [campaignsFromLeads, excluded] = await Promise.all([
    db.lead.findMany({
      where: { campaignId: { not: null } },
      select: { campaignId: true, campaignName: true },
      distinct: ["campaignId"],
    }),
    db.excludedCampaign.findMany().catch(() => []),
  ])

  const excludedMap = new Map(excluded.map((e) => [e.campaignId, e.campaignName]))

  const merged = new Map<string, { campaignId: string; campaignName: string | null; excluded: boolean }>()
  for (const c of campaignsFromLeads) {
    merged.set(c.campaignId!, { campaignId: c.campaignId!, campaignName: c.campaignName, excluded: excludedMap.has(c.campaignId!) })
  }
  for (const e of excluded) {
    if (!merged.has(e.campaignId)) merged.set(e.campaignId, { campaignId: e.campaignId, campaignName: e.campaignName, excluded: true })
  }

  const campaigns = Array.from(merged.values()).sort((a, b) =>
    (a.campaignName ?? a.campaignId).localeCompare(b.campaignName ?? b.campaignId)
  )

  return <ExcludedCampaignsClient campaigns={campaigns} />
}
