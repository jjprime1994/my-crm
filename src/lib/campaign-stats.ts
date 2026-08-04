import { db } from "@/lib/db"

// Campaigns where CPL is hidden because not all leads flow through the CRM
const CPL_EXCLUDED_CAMPAIGNS = new Set(["Location Ads"])

export type CampaignPerformanceRow = {
  name: string
  status: string | null
  dailyBudget: number | null
  spendToday: number | null
  spendPeriod: number | null
  cpl: number | null
  total: number
  claimed: number
  unclaimed: number
  won: number
  lost: number
  conversion: number
}

export async function getCampaignPerformance(since: Date | null): Promise<{
  campaigns: CampaignPerformanceRow[]
  metaError: string | null
  metaConfigured: boolean
}> {
  const dateFilter = since ? { createdAt: { gte: since } } : {}

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

  // Meta Ads API — spend, budget, CPL per campaign. Needs a token with `ads_read` on the
  // ad account (a System User token, ideally) — a Page access token cannot query /act_.../
  // endpoints at all, so this is intentionally a separate credential from META_PAGE_ACCESS_TOKEN
  // (which is used only for the lead-retrieval webhook).
  type MetaCampaignData = { spendToday: number; spendPeriod: number; dailyBudget: number | null; status: string }
  const metaData = new Map<string, MetaCampaignData>()
  const metaToken = process.env.META_ADS_ACCESS_TOKEN
  const metaAccountId = process.env.META_AD_ACCOUNT_ID
    ? `act_${process.env.META_AD_ACCOUNT_ID.replace(/^act_/, "")}`
    : undefined
  let metaError: string | null = null

  // Meta paginates results (~25 per page by default) — without following `paging.next`,
  // any campaigns past the first page silently get no budget/spend data.
  async function fetchAllPages(url: string): Promise<{ data: Record<string, unknown>[]; error?: { message: string; type: string; code: number; error_subcode?: number; fbtrace_id: string } }> {
    const data: Record<string, unknown>[] = []
    let next: string | undefined = url
    while (next) {
      const res: Response = await fetch(next, { next: { revalidate: 300 } })
      const json = await res.json()
      if (json.error) return { data, error: json.error }
      data.push(...(json.data ?? []))
      next = json.paging?.next
    }
    return { data }
  }

  if (metaToken && metaAccountId) {
    try {
      const fmtDate = (d: Date) => d.toISOString().split("T")[0]
      const periodParam = since
        ? `time_range=${encodeURIComponent(JSON.stringify({ since: fmtDate(since), until: fmtDate(new Date()) }))}`
        : `date_preset=maximum`
      const base = `https://graph.facebook.com/v19.0`
      const fields = `campaign_name,spend`

      const [campsResult, todayResult, periodResult] = await Promise.all([
        fetchAllPages(`${base}/${metaAccountId}/campaigns?fields=name,daily_budget,lifetime_budget,status&limit=500&access_token=${metaToken}`),
        fetchAllPages(`${base}/${metaAccountId}/insights?level=campaign&fields=${fields}&date_preset=today&limit=500&access_token=${metaToken}`),
        fetchAllPages(`${base}/${metaAccountId}/insights?level=campaign&fields=${fields}&${periodParam}&limit=500&access_token=${metaToken}`),
      ])

      const firstError = campsResult.error ?? todayResult.error ?? periodResult.error
      if (firstError) {
        const e = firstError
        metaError = `${e.message} [type=${e.type}, code=${e.code}, subcode=${e.error_subcode ?? "none"}, trace=${e.fbtrace_id}]`
      } else {
        const budgetMap = new Map<string, { dailyBudget: number | null; status: string }>()
        for (const c of campsResult.data) {
          budgetMap.set(c.name as string, {
            dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
            status: (c.status as string) ?? "UNKNOWN",
          })
        }
        const todaySpend = new Map<string, number>()
        for (const ins of todayResult.data) todaySpend.set(ins.campaign_name as string, Number(ins.spend ?? 0))

        for (const ins of periodResult.data) {
          const campaignName = ins.campaign_name as string
          const b = budgetMap.get(campaignName) ?? { dailyBudget: null, status: "UNKNOWN" }
          metaData.set(campaignName, {
            spendToday: todaySpend.get(campaignName) ?? 0,
            spendPeriod: Number(ins.spend ?? 0),
            dailyBudget: b.dailyBudget,
            status: b.status,
          })
        }
        // Add campaigns that ran but had no spend this period
        for (const [name, b] of budgetMap.entries()) {
          if (!metaData.has(name)) {
            metaData.set(name, {
              spendToday: todaySpend.get(name) ?? 0,
              spendPeriod: 0,
              dailyBudget: b.dailyBudget,
              status: b.status,
            })
          }
        }
      }
    } catch {
      metaError = "Could not reach Meta API"
    }
  }

  const campaigns: CampaignPerformanceRow[] = Array.from(campaignMap.entries())
    .map(([name, s]) => {
      const meta = metaData.get(name) ?? null
      const cplExcluded = CPL_EXCLUDED_CAMPAIGNS.has(name)
      return {
        name,
        status: meta?.status ?? null,
        dailyBudget: meta?.dailyBudget ?? null,
        spendToday: meta?.spendToday ?? null,
        spendPeriod: meta?.spendPeriod ?? null,
        cpl: !cplExcluded && meta && meta.spendPeriod > 0 && s.total > 0 ? meta.spendPeriod / s.total : null,
        total: s.total,
        claimed: s.claimed,
        unclaimed: s.total - s.claimed,
        won: s.won,
        lost: s.lost,
        conversion: s.total > 0 ? Math.round((s.won / s.total) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total)

  return { campaigns, metaError, metaConfigured: Boolean(metaToken) }
}
