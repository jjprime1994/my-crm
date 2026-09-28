import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

// GET: all known campaigns (from leads) merged with manually-added/excluded ones
export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

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
