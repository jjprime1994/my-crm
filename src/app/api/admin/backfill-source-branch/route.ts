import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { resolveStateBranch } from "@/lib/branch"

type FieldEntry = { name: string; values: string[] }

function extractBranchFromFields(fields: FieldEntry[]): string | null {
  const get = (key: string) => fields.find((f) => f.name === key)?.values?.[0]
  const raw =
    get("state") ??
    get("location") ??
    get("city") ??
    get("where_are_you_from") ??
    get("negeri") ??
    get("kawasan") ??
    get('which_state_are_you_located_in?') ??
    get("which_state_are_you_located_in")
  return resolveStateBranch(raw)
}

async function run() {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN not set")

  const leads = await db.lead.findMany({
    where: {
      OR: [
        { source: null },
        { source: "" },
        { adName: null },
        { adName: "" },
        { campaignName: null },
        { campaignName: "" },
        { branch: null },
      ],
      metaLeadId: { not: null },
    },
    select: { id: true, metaLeadId: true, adId: true, campaignId: true, adName: true, campaignName: true, branch: true, source: true, rawData: true },
  })

  let updated = 0
  let failed = 0
  let noData = 0

  for (const lead of leads) {
    try {
      const updates: Record<string, string | null> = {}

      // Fix source
      if (!lead.source) updates.source = "META"

      // Extract branch from stored rawData first — no API call needed
      let branch = lead.branch
      if (!branch) {
        const fields: FieldEntry[] = Array.isArray(raw?.field_data) ? (raw!.field_data as FieldEntry[]) : []
        branch = extractBranchFromFields(fields)
      }

      // Fetch adName/campaignName from Meta if missing
      let adName = lead.adName
      let campaignName = lead.campaignName
      const raw = lead.rawData as Record<string, unknown> | null
      let adId = lead.adId ?? (raw?.ad_id as string | null) ?? null
      let campaignId = lead.campaignId ?? (raw?.campaign_id as string | null) ?? null

      if (!adName || !campaignName) {
        // Get ad_id/campaign_id from Meta leadgen API if still not found
        if (!adId && !campaignId) {
          const lgRes = await fetch(
            `https://graph.facebook.com/v19.0/${lead.metaLeadId}?fields=ad_id,campaign_id&access_token=${token}`
          )
          const lgData = await lgRes.json()
          if (!lgData.error) {
            adId = lgData.ad_id ?? null
            campaignId = lgData.campaign_id ?? null
          }
        }

        if (adId && !adName) {
          const adRes = await fetch(
            `https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{name}&access_token=${token}`
          )
          const adData = await adRes.json()
          if (!adData.error) {
            if (adData.name) adName = adData.name
            if (adData.campaign?.name) campaignName = adData.campaign.name
          }
        }

        if (!campaignName && campaignId) {
          const campRes = await fetch(
            `https://graph.facebook.com/v19.0/${campaignId}?fields=name&access_token=${token}`
          )
          const campData = await campRes.json()
          if (!campData.error && campData.name) campaignName = campData.name
        }

        if (adId && adId !== lead.adId) updates.adId = adId
        if (campaignId && campaignId !== lead.campaignId) updates.campaignId = campaignId
        if (adName && adName !== lead.adName) updates.adName = adName
        if (campaignName && campaignName !== lead.campaignName) updates.campaignName = campaignName
      }

      // Fallback: resolve branch from campaign/ad name
      if (!branch && campaignName) branch = resolveStateBranch(campaignName)
      if (!branch && adName) branch = resolveStateBranch(adName)
      if (branch && branch !== lead.branch) updates.branch = branch

      if (Object.keys(updates).length === 0) { noData++; continue }

      await db.lead.update({ where: { id: lead.id }, data: updates })
      updated++
    } catch {
      failed++
    }

    await new Promise((r) => setTimeout(r, 150))
  }

  return { total: leads.length, updated, noData, failed }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })
  return NextResponse.json(await run())
}
