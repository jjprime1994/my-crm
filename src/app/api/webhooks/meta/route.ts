import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import crypto from "crypto"

// GET: Meta webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

// POST: Receive new lead notifications from Meta
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify signature from Meta — return 200 even on mismatch so Meta doesn't mark as rejected
  const signature = req.headers.get("x-hub-signature-256")
  if (process.env.META_APP_SECRET && signature) {
    const expectedSig =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.META_APP_SECRET)
        .update(rawBody)
        .digest("hex")
    if (signature !== expectedSig) {
      return NextResponse.json({ ok: true })
    }
  }

  const body = JSON.parse(rawBody)

  if (body.object !== "page") {
    return NextResponse.json({ ok: true })
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue

      const { leadgen_id, form_id, ad_id, campaign_id, adgroup_id } = change.value

      // Fetch full lead data from Meta Graph API (ad_name + campaign_name come from the leadgen object directly)
      let firstName, lastName, email, phone, adName, campaignName
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data,ad_name,campaign_name&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
        )
        const data = await res.json()
        const fields: { name: string; values: string[] }[] = data.field_data ?? []
        const get = (key: string) => fields.find((f) => f.name === key)?.values?.[0]
        email = get("email")
        phone = get("phone_number") ?? get("phone")
        adName = data.ad_name ?? undefined
        campaignName = data.campaign_name ?? undefined

        // Handle both first_name/last_name and full_name field formats
        const fullName = get("full_name")
        if (fullName) {
          const parts = fullName.trim().split(" ")
          firstName = parts[0]
          lastName = parts.slice(1).join(" ") || undefined
        } else {
          firstName = get("first_name")
          lastName = get("last_name")
        }
      } catch {
        // store whatever we have
      }

      // Check for duplicate phone/email
      let isDuplicate = false
      if (phone || email) {
        const existing = await db.lead.findFirst({
          where: {
            metaLeadId: { not: leadgen_id },
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
        where: { metaLeadId: leadgen_id },
        update: {},
        create: {
          metaLeadId: leadgen_id,
          formId: form_id,
          adId: ad_id,
          adName,
          campaignId: campaign_id,
          campaignName,
          firstName,
          lastName,
          email,
          phone,
          isDuplicate,
          rawData: change.value,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
