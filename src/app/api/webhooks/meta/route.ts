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

  // Verify signature from Meta
  const signature = req.headers.get("x-hub-signature-256")
  if (process.env.META_APP_SECRET && signature) {
    const expectedSig =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.META_APP_SECRET)
        .update(rawBody)
        .digest("hex")
    if (signature !== expectedSig) {
      return new NextResponse("Invalid signature", { status: 401 })
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

      // Fetch full lead data from Meta Graph API
      let firstName, lastName, email, phone, adName, campaignName
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
        )
        const data = await res.json()
        const fields: { name: string; values: string[] }[] = data.field_data ?? []
        const get = (key: string) => fields.find((f) => f.name === key)?.values?.[0]
        firstName = get("first_name")
        lastName = get("last_name")
        email = get("email")
        phone = get("phone_number") ?? get("phone")

        // Fetch ad name if we have an ad_id
        if (ad_id) {
          const adRes = await fetch(
            `https://graph.facebook.com/v19.0/${ad_id}?fields=name&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
          )
          const adData = await adRes.json()
          adName = adData.name
        }

        if (campaign_id) {
          const campRes = await fetch(
            `https://graph.facebook.com/v19.0/${campaign_id}?fields=name&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
          )
          const campData = await campRes.json()
          campaignName = campData.name
        }
      } catch {
        // store whatever we have
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
          rawData: change.value,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
