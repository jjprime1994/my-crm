import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

export async function POST() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return new NextResponse("META_PAGE_ACCESS_TOKEN not set", { status: 500 })

  // Get all leads that have an adId so we can re-fetch their real ad name
  const leads = await db.lead.findMany({
    where: { adId: { not: null } },
    select: { id: true, adId: true, campaignId: true },
  })

  let updated = 0
  let failed = 0
  let sampleError: unknown = null

  for (const lead of leads) {
    try {
      let adName: string | undefined
      let campaignName: string | undefined

      if (lead.adId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${lead.adId}?fields=name,campaign{name}&access_token=${token}`
        )
        const data = await res.json()
        if (data.error && !sampleError) sampleError = data.error
        if (data.name) adName = data.name
        if (data.campaign?.name) campaignName = data.campaign.name
      }

      if (!campaignName && lead.campaignId) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${lead.campaignId}?fields=name&access_token=${token}`
        )
        const data = await res.json()
        if (data.error && !sampleError) sampleError = data.error
        if (data.name) campaignName = data.name
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
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({ total: leads.length, updated, failed, sampleError })
}
