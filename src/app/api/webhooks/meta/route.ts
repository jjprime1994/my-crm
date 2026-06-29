import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import crypto from "crypto"
import { resolveStateBranch } from "@/lib/branch"
import { assignToDefaultTeam } from "@/lib/assign-default-team"
import { sendPushToSuperAdmins } from "@/lib/push"

// Cooldown so super admins don't get spammed if many leads arrive while token is broken
let lastTokenAlertAt = 0
const TOKEN_ALERT_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

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

  // Verify signature from Meta — return 200 even on failure so Meta doesn't retry
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error("[meta-webhook] META_APP_SECRET not configured — payload rejected")
    return NextResponse.json({ ok: true })
  }
  const signature = req.headers.get("x-hub-signature-256")
  if (!signature) {
    console.error("[meta-webhook] Missing x-hub-signature-256 header — payload rejected")
    return NextResponse.json({ ok: true })
  }
  const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
  if (signature !== expectedSig) {
    return NextResponse.json({ ok: true })
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
      let firstName, lastName, email, phone, adName, campaignName, branch: string | null = null
      let fieldData: { name: string; values: string[] }[] = []
      const token = process.env.META_PAGE_ACCESS_TOKEN
      try {
        // Fetch form fields (contact info)
        const leadRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data&access_token=${token}`
        )
        const leadData = await leadRes.json()
        if (leadData.error) {
          console.error("[meta-webhook] leadgen fetch error:", JSON.stringify(leadData.error), "leadgen_id:", leadgen_id)
          const now = Date.now()
          if (now - lastTokenAlertAt > TOKEN_ALERT_COOLDOWN_MS) {
            lastTokenAlertAt = now
            sendPushToSuperAdmins({
              title: "⚠️ Meta Token Broken — Leads Coming in Blank",
              body: "The Facebook access token has expired or lost permission. Go to patch notes for fix instructions.",
              url: "/patch-notes",
            }).catch(() => {})
          }
        }
        const fields: { name: string; values: string[] }[] = leadData.field_data ?? []
        if (fields.length === 0) {
          console.warn("[meta-webhook] empty field_data for leadgen_id:", leadgen_id, "raw:", JSON.stringify(leadData))
        }
        fieldData = fields
        const get = (key: string) => fields.find((f) => f.name === key)?.values?.[0]
        email = get("email")
        phone = get("phone_number") ?? get("phone") ?? get("whatsapp_number") ?? get("whatsapp") ?? get("mobile_phone") ?? get("mobile") ?? get("contact_number") ?? get("hp") ?? get("handphone") ?? get("no_telefon") ?? get("telefon")

        // Extract branch from state/location form field
        const rawLocation = get("state") ?? get("location") ?? get("city") ?? get("where_are_you_from") ?? get("negeri") ?? get("kawasan") ?? get("which_state_are_you_located_in?") ?? get("which_state_are_you_located_in")
        branch = resolveStateBranch(rawLocation)

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

        // Fetch ad name directly from the ad object using ad_id — more reliable than leadgen.ad_name
        if (ad_id) {
          const adRes = await fetch(
            `https://graph.facebook.com/v19.0/${ad_id}?fields=name,campaign{name}&access_token=${token}`
          )
          const adData = await adRes.json()
          if (adData.error) {
            console.error("[meta-webhook] ad fetch error:", JSON.stringify(adData.error), "ad_id:", ad_id)
          } else {
            if (adData.name) adName = adData.name
            if (adData.campaign?.name) campaignName = adData.campaign.name
          }
        }

        // Fallback: try campaign name from campaign_id if still missing
        if (!campaignName && campaign_id) {
          const campRes = await fetch(
            `https://graph.facebook.com/v19.0/${campaign_id}?fields=name&access_token=${token}`
          )
          const campData = await campRes.json()
          if (campData.error) {
            console.error("[meta-webhook] campaign fetch error:", JSON.stringify(campData.error), "campaign_id:", campaign_id)
          } else if (campData.name) {
            campaignName = campData.name
          }
        }
      } catch (err) {
        console.error("[meta-webhook] fetch exception:", err)
      }

      // Fall back to campaign/ad name if form field gave no branch
      if (!branch && campaignName) branch = resolveStateBranch(campaignName)
      if (!branch && adName) branch = resolveStateBranch(adName)

      // Auto-assign via StateRoute round-robin — only members of a StateRoute are eligible
      let assignedToId: string | null = null
      if (branch) {
        const stateRoute = await db.stateRoute.findUnique({
          where: { state: branch },
          select: { id: true, userIds: true, lastAssignedIndex: true },
        })
        if (stateRoute && stateRoute.userIds.length > 0) {
          const userIds = stateRoute.userIds
          const [users, activeCounts] = await Promise.all([
            db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, claimLimit: true } }),
            db.lead.groupBy({
              by: ["assignedToId"],
              where: { assignedToId: { in: userIds }, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
              _count: { id: true },
            }),
          ])
          const limitMap = Object.fromEntries(users.map((u) => [u.id, u.claimLimit]))
          const countMap = Object.fromEntries(activeCounts.map((r) => [r.assignedToId!, r._count.id]))
          const startIdx = stateRoute.lastAssignedIndex % userIds.length
          let chosenIdx = -1
          for (let i = 0; i < userIds.length; i++) {
            const idx = (startIdx + i) % userIds.length
            const uid = userIds[idx]
            if ((countMap[uid] ?? 0) < (limitMap[uid] ?? 5)) {
              assignedToId = uid
              chosenIdx = idx
              break
            }
          }
          if (chosenIdx !== -1) {
            await db.stateRoute.update({
              where: { id: stateRoute.id },
              data: { lastAssignedIndex: chosenIdx + 1 },
            })
          }
        }
      }

      // Flag as duplicate only if an active lead with same contact exists within 30 days
      let isDuplicate = false
      if (phone || email) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const existing = await db.lead.findFirst({
          where: {
            metaLeadId: { not: leadgen_id },
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
      if (isDuplicate) assignedToId = null

      // Fallback: if no state route matched and not a duplicate, assign to Johnny's team
      if (!assignedToId && !isDuplicate) {
        assignedToId = await assignToDefaultTeam()
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
          branch,
          source: "META",
          isDuplicate,
          assignedToId,
          rawData: { ...change.value, field_data: fieldData },
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
