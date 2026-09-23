import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { handleInboundWhatsAppMessage } from "@/lib/whatsapp-bot"

// GET: WhatsApp Cloud API webhook verification handshake (same shape as the Meta Lead Ads webhook)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

// POST: Receive inbound WhatsApp messages
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify signature from Meta — return 200 even on failure so Meta doesn't retry
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET not configured — payload rejected")
    return NextResponse.json({ ok: true })
  }
  const signature = req.headers.get("x-hub-signature-256")
  if (!signature) {
    console.error("[whatsapp-webhook] Missing x-hub-signature-256 header — payload rejected")
    return NextResponse.json({ ok: true })
  }
  const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
  if (signature !== expectedSig) {
    return NextResponse.json({ ok: true })
  }

  const body = JSON.parse(rawBody)

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true })
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue

      for (const message of change.value?.messages ?? []) {
        try {
          await handleInboundWhatsAppMessage(message)
        } catch (err) {
          console.error("[whatsapp-webhook] message handling error:", err, "from:", message.from)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
