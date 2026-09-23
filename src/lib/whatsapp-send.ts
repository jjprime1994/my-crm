// Thin wrapper around the WhatsApp Cloud API's /messages endpoint.
// Uses native interactive button/list message types — no WhatsApp Flows, no
// encryption setup, per the light-validation scope this bot needs.

const GRAPH_VERSION = "v19.0"

async function sendRaw(payload: Record<string, unknown>) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !token) {
    console.error("[whatsapp-send] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured")
    return
  }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) {
    console.error("[whatsapp-send] send failed:", JSON.stringify(data?.error ?? data))
  }
  return data
}

export async function sendWhatsAppText(to: string, body: string) {
  return sendRaw({ to, type: "text", text: { body } })
}

export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  return sendRaw({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
    },
  })
}

export async function sendWhatsAppList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: { id: string; title: string; description?: string }[]
) {
  return sendRaw({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel,
        sections: [{ title: "Options", rows: rows.slice(0, 10) }],
      },
    },
  })
}
