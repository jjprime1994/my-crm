import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import crypto from "crypto"
import { resolveStateBranch } from "@/lib/branch"

// TikTok sends a GET with a verification code to confirm the endpoint on setup
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? req.nextUrl.searchParams.get("verification_code")
  if (code) return new NextResponse(code, { status: 200 })
  return new NextResponse("ok", { status: 200 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify HMAC-SHA256 signature from TikTok
  // TikTok sends the signature in the x-tiktok-signature header
  const signature = req.headers.get("x-tiktok-signature")
  if (process.env.TIKTOK_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac("sha256", process.env.TIKTOK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex")
    if (signature !== expected) {
      return NextResponse.json({ ok: true })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  // TikTok may wrap the payload in { type, data } or send it flat
  const data = (body.data as Record<string, unknown>) ?? body

  const leadId = data.lead_id?.toString()
  if (!leadId) return NextResponse.json({ ok: true })

  // TikTok field_data can be [{name, value}] or [{name, values: []}]
  const rawFields = (data.field_data ?? data.fields ?? []) as { name: string; value?: string; values?: string[] }[]
  const get = (key: string) => {
    const f = rawFields.find((x) => x.name === key)
    if (!f) return undefined
    return (f.value ?? f.values?.[0])?.trim() || undefined
  }

  const fullName = get("full_name") ?? get("name")
  let firstName: string | undefined, lastName: string | undefined
  if (fullName) {
    const parts = fullName.split(" ")
    firstName = parts[0]
    lastName = parts.slice(1).join(" ") || undefined
  } else {
    firstName = get("first_name")
    lastName = get("last_name")
  }

  const phone = get("phone_number") ?? get("phone")
  const email = get("email")

  const rawLocation = get("state") ?? get("location") ?? get("city") ?? get("negeri") ?? get("where_are_you_from")
  let branch = resolveStateBranch(rawLocation)

  const adId = data.ad_id?.toString()
  const campaignId = data.campaign_id?.toString()
  const formId = data.form_id?.toString()
  const adName = (data.ad_name as string | undefined) ?? undefined
  const campaignName = (data.campaign_name as string | undefined) ?? undefined

  if (!branch && campaignName) branch = resolveStateBranch(campaignName)
  if (!branch && adName) branch = resolveStateBranch(adName)

  // Flag as duplicate only if an active lead with same contact exists within 30 days
  let isDuplicate = false
  if (phone || email) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const existing = await db.lead.findFirst({
      where: {
        metaLeadId: { not: `tiktok_${leadId}` },
        createdAt: { gte: thirtyDaysAgo },
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        OR: [
          phone ? { phone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true },
    })
    if (existing) isDuplicate = true
  }

  await db.lead.upsert({
    where: { metaLeadId: `tiktok_${leadId}` },
    update: {},
    create: {
      metaLeadId: `tiktok_${leadId}`,
      formId,
      adId,
      adName,
      campaignId,
      campaignName,
      firstName,
      lastName,
      email,
      phone,
      branch,
      source: "TIKTOK",
      isDuplicate,
      rawData: body as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ ok: true })
}
