import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { resolveStateBranch } from "@/lib/branch"

// Health check / connectivity test for whoever is wiring up the website form
export async function GET() {
  return NextResponse.json({ ok: true, service: "website-enquiry-webhook" })
}

// POST: Receive a website contact-form enquiry.
// Unlike the Meta/TikTok webhooks, this isn't a platform with its own retry policy,
// so it returns real HTTP status codes instead of always-200.
export async function POST(req: NextRequest) {
  const secret = process.env.WEBSITE_FORM_SECRET
  if (!secret) {
    console.error("[website-webhook] WEBSITE_FORM_SECRET not configured — payload rejected")
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 })
  }
  if (req.headers.get("x-website-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 })
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : undefined)

  // Honeypot: a real visitor never fills this hidden field. Bots that do get a fake success.
  if (str(body.honeypot)) {
    return NextResponse.json({ ok: true })
  }

  let firstName = str(body.firstName)
  let lastName = str(body.lastName)
  if (!firstName && !lastName) {
    const fullName = str(body.name)
    if (fullName) {
      const parts = fullName.split(" ")
      firstName = parts[0]
      lastName = parts.slice(1).join(" ") || undefined
    }
  }

  const email = str(body.email)
  const phone = str(body.phone)
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: "email or phone is required" }, { status: 400 })
  }

  const branch = resolveStateBranch(str(body.state) ?? str(body.location) ?? str(body.branch))
  const message = str(body.message)

  // Optional attribution from the website form. utm_campaign becomes campaignName so the
  // Campaign filter/reports include website leads. adName is left null on purpose —
  // routing keys off adName, and website leads must keep routing by state.
  const utmSource = str(body.utm_source)
  const utmMedium = str(body.utm_medium)
  const utmCampaign = str(body.utm_campaign)
  const page = str(body.page) ?? str(body.pageUrl) ?? str(body.url)

  // Flag as duplicate only if an active lead with same contact exists within 30 days
  let isDuplicate = false
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const existing = await db.lead.findFirst({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      OR: [phone ? { phone } : undefined, email ? { email } : undefined].filter(Boolean) as object[],
    },
    select: { id: true },
  })
  if (existing) isDuplicate = true

  // Leave unassigned so it lands in the Available Leads pool for the right
  // state team (or default team) to claim, rather than auto-assigning to one person.
  const lead = await db.lead.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      branch,
      source: "WEBSITE",
      campaignName: utmCampaign,
      isDuplicate,
      assignedToId: null,
      rawData: body as Prisma.InputJsonValue,
    },
  })

  if (message) {
    await db.leadNote.create({
      data: { leadId: lead.id, authorId: null, content: `Website enquiry message: ${message}` },
    })
  }

  const attribution = [
    page ? `Page: ${page}` : null,
    utmSource ? `UTM source: ${utmSource}` : null,
    utmMedium ? `UTM medium: ${utmMedium}` : null,
    utmCampaign ? `UTM campaign: ${utmCampaign}` : null,
  ].filter(Boolean).join(" · ")
  if (attribution) {
    await db.leadNote.create({
      data: { leadId: lead.id, authorId: null, content: `Attribution: ${attribution}` },
    })
  }

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 })
}
