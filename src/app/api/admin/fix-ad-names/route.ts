import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

// GET: diagnostic — visit in browser to see Meta API status without changing anything
export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: "META_PAGE_ACCESS_TOKEN is not set in environment variables" })

  const tokenPreview = token.slice(0, 12) + "…"

  const sample = await db.lead.findFirst({
    where: { adId: { not: null } },
    select: { id: true, adId: true, campaignId: true, adName: true, campaignName: true },
    orderBy: { createdAt: "desc" },
  })

  if (!sample) {
    return NextResponse.json({ tokenPreview, error: "No leads with an adId found in the database" })
  }

  const adRes = await fetch(
    `https://graph.facebook.com/v19.0/${sample.adId}?fields=name,campaign{name}&access_token=${token}`
  )
  const adData = await adRes.json()

  let campData: unknown = null
  if (!adData.name && sample.campaignId) {
    const campRes = await fetch(
      `https://graph.facebook.com/v19.0/${sample.campaignId}?fields=name&access_token=${token}`
    )
    campData = await campRes.json()
  }

  return NextResponse.json({
    tokenPreview,
    sampleLead: { id: sample.id, adId: sample.adId, campaignId: sample.campaignId, currentAdName: sample.adName, currentCampaignName: sample.campaignName },
    metaAdResponse: adData,
    metaCampaignResponse: campData,
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

  // Target all leads missing a campaign name that have at least one Meta ID to look up
  const leads = await db.lead.findMany({
    where: {
      campaignName: null,
      OR: [{ adId: { not: null } }, { campaignId: { not: null } }],
    },
    select: { id: true, adId: true, campaignId: true },
  })

  let updated = 0
  let failed = 0
  let noData = 0
  const errors: string[] = []

  for (const lead of leads) {
    try {
      let adName: string | undefined
      let campaignName: string | undefined

      if (lead.adId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${lead.adId}?fields=name,campaign{name}&access_token=${token}`
        )
        const data = await res.json()
        if (data.error) {
          errors.push(`adId ${lead.adId}: ${data.error.message}`)
        } else {
          if (data.name) adName = data.name
          if (data.campaign?.name) campaignName = data.campaign.name
        }
      }

      if (!campaignName && lead.campaignId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${lead.campaignId}?fields=name&access_token=${token}`
        )
        const data = await res.json()
        if (data.error) {
          errors.push(`campaignId ${lead.campaignId}: ${data.error.message}`)
        } else if (data.name) {
          campaignName = data.name
        }
      }

      if (adName || campaignName) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            ...(adName ? { adName } : {}),
            ...(campaignName ? { campaignName } : {}),
          },
        })
        updated++
      } else {
        noData++
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({ total: leads.length, updated, noData, failed, errors: errors.slice(0, 5) })
}
