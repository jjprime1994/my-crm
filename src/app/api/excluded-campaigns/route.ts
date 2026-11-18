import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { getCampaignEntries } from "@/lib/excluded-campaigns"

// GET: all known campaigns (from leads) merged with manually-added/excluded ones
export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const campaigns = await getCampaignEntries()

  return NextResponse.json({ campaigns })
}

// POST: exclude a campaign (upsert by campaignId)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { campaignId, campaignName } = await req.json()
  if (!campaignId) return new NextResponse("campaignId required", { status: 400 })

  const row = await db.excludedCampaign.upsert({
    where: { campaignId },
    create: { campaignId, campaignName: campaignName ?? null },
    update: { ...(campaignName !== undefined && { campaignName }) },
  })

  return NextResponse.json(row)
}

// DELETE: un-exclude a campaign (let it flow into the CRM again)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { campaignId } = await req.json()
  if (!campaignId) return new NextResponse("campaignId required", { status: 400 })

  await db.excludedCampaign.deleteMany({ where: { campaignId } })

  return new NextResponse(null, { status: 204 })
}
