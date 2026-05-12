import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

// GET: diagnostic — shows leads missing campaign name and attempts Meta lookup on them
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (key !== process.env.BACKFILL_SECRET) {
    const session = await auth()
    if (!session || !isSuperAdmin(session.user.role))
      return new NextResponse("Forbidden", { status: 403 })
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: "META_PAGE_ACCESS_TOKEN is not set" })

  const missing = await db.lead.findMany({
    where: { campaignName: null },
    select: { id: true, adId: true, campaignId: true, adName: true, metaLeadId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  // For the first one that has any Meta ID, try a live lookup to see what the API returns
  const sample = missing.find((l) => l.adId || l.campaignId)
  let sampleLookup: unknown = null
  if (sample?.adId) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${sample.adId}?fields=name,campaign{name}&access_token=${token}`)
    sampleLookup = await r.json()
  } else if (sample?.campaignId) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${sample.campaignId}?fields=name&access_token=${token}`)
    sampleLookup = await r.json()
  }

  return NextResponse.json({
    totalMissingCampaignName: missing.length,
    withAdId: missing.filter((l) => l.adId).length,
    withCampaignId: missing.filter((l) => l.campaignId).length,
    withNoIds: missing.filter((l) => !l.adId && !l.campaignId).length,
    leads: missing.map((l) => ({ id: l.id, adId: l.adId, campaignId: l.campaignId, adName: l.adName, metaLeadId: l.metaLeadId, createdAt: l.createdAt })),
    sampleLookup,
  })
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (key !== process.env.BACKFILL_SECRET) {
    const session = await auth()
    if (!session || !isSuperAdmin(session.user.role))
      return new NextResponse("Forbidden", { status: 403 })
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return new NextResponse("META_PAGE_ACCESS_TOKEN not set", { status: 500 })

  // All leads missing a campaign name
  const leads = await db.lead.findMany({
    where: { campaignName: null },
    select: { id: true, adId: true, campaignId: true, metaLeadId: true },
  })

  let updated = 0
  let failed = 0
  let noData = 0
  const errors: string[] = []

  for (const lead of leads) {
    try {
      let adId = lead.adId
      let campaignId = lead.campaignId
      let adName: string | undefined
      let campaignName: string | undefined

      // If no adId/campaignId stored, fetch from the leadgen object using metaLeadId
      if (!adId && !campaignId && lead.metaLeadId) {
        const lgRes = await fetch(
          `https://graph.facebook.com/v19.0/${lead.metaLeadId}?fields=ad_id,campaign_id&access_token=${token}`
        )
        const lgData = await lgRes.json()
        if (!lgData.error) {
          adId = lgData.ad_id ?? null
          campaignId = lgData.campaign_id ?? null
        }
      }

      if (adId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{name}&access_token=${token}`
        )
        const data = await res.json()
        if (data.error) {
          errors.push(`adId ${adId}: ${data.error.message}`)
        } else {
          if (data.name) adName = data.name
          if (data.campaign?.name) campaignName = data.campaign.name
        }
      }

      if (!campaignName && campaignId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${campaignId}?fields=name&access_token=${token}`
        )
        const data = await res.json()
        if (data.error) {
          errors.push(`campaignId ${campaignId}: ${data.error.message}`)
        } else if (data.name) {
          campaignName = data.name
        }
      }

      if (adName || campaignName || adId || campaignId) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            ...(adId ? { adId } : {}),
            ...(campaignId ? { campaignId } : {}),
            ...(adName ? { adName } : {}),
            ...(campaignName ? { campaignName } : {}),
          },
        })
        if (campaignName || adName) updated++
        else noData++
      } else {
        noData++
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({ total: leads.length, updated, noData, failed, errors: errors.slice(0, 5) })
}
