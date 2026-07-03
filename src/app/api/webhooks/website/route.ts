import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { resolveStateBranch } from "@/lib/branch"
import { assignLeadByBranch } from "@/lib/route-lead"
import { assignToDefaultTeam } from "@/lib/assign-default-team"

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

  let assignedToId: string | null = null
  if (!isDuplicate) {
    assignedToId = await assignLeadByBranch(branch)
    if (!assignedToId) assignedToId = await assignToDefaultTeam()
  }

  const lead = await db.lead.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      branch,
      source: "WEBSITE",
      isDuplicate,
      assignedToId,
      rawData: body as Prisma.InputJsonValue,
    },
  })

  if (message) {
    await db.leadNote.create({
      data: { leadId: lead.id, authorId: null, content: `Website enquiry message: ${message}` },
    })
  }

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 })
}
