import { db } from "@/lib/db"
import { resolveStateBranch, MALAYSIA_STATES } from "@/lib/branch"
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from "@/lib/whatsapp-send"

// Minimal shape of one entry in the Cloud API webhook's value.messages[] array.
type InboundMessage = {
  from: string
  type: string
  text?: { body?: string }
  interactive?: {
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
  referral?: { source_id?: string; source_type?: string }
}

const VALIDATE_YES = "validate_yes"
const VALIDATE_NO = "validate_no"

function replyId(message: InboundMessage): string | undefined {
  return message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id
}

function formatSlotTime(startAt: Date): string {
  return startAt.toLocaleString("en-MY", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur",
  }) + " MYT"
}

// Ad/campaign name lookup for Click-to-WhatsApp referrals — same Graph API call and
// token (ads-read scoped) that src/app/api/webhooks/meta/route.ts already uses for
// Lead Ads attribution. WHATSAPP_ACCESS_TOKEN (messaging-scoped) can't read ad objects.
async function resolveAdAttribution(referral: InboundMessage["referral"]) {
  if (!referral?.source_id || referral.source_type !== "ad") return { adId: undefined, adName: undefined, campaignName: undefined }
  const adId = referral.source_id
  const token = process.env.META_PAGE_ACCESS_TOKEN
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{name}&access_token=${token}`)
    const data = await res.json()
    if (data.error) {
      console.error("[whatsapp-bot] ad fetch error:", JSON.stringify(data.error), "ad_id:", adId)
      return { adId, adName: undefined, campaignName: undefined }
    }
    return { adId, adName: data.name as string | undefined, campaignName: data.campaign?.name as string | undefined }
  } catch (err) {
    console.error("[whatsapp-bot] ad fetch exception:", err)
    return { adId, adName: undefined, campaignName: undefined }
  }
}

async function startConversation(phone: string, referral: InboundMessage["referral"]) {
  // Reuse an existing active lead for this phone (e.g. they already came in via
  // Meta Lead Ads) rather than spawning a second Lead row for the same person.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const existing = await db.lead.findFirst({
    where: { phone, createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
    select: { id: true },
  })

  let leadId: string
  if (existing) {
    leadId = existing.id
    await db.leadNote.create({
      data: { leadId, authorId: null, isSystem: true, content: "Also reached out via WhatsApp." },
    })
  } else {
    const { adId, adName, campaignName } = await resolveAdAttribution(referral)
    const lead = await db.lead.create({
      data: { phone, source: "WHATSAPP", status: "NEW", adId, adName, campaignName, rawData: referral ? { referral } : undefined },
    })
    leadId = lead.id
  }

  const conversation = await db.whatsAppConversation.create({
    data: { phone, leadId, state: "AWAITING_VALIDATION" },
  })

  await sendWhatsAppButtons(
    phone,
    "Hi! Thanks for reaching out to Nu Vending. Are you interested in a vending machine partnership?",
    [{ id: VALIDATE_YES, title: "Yes" }, { id: VALIDATE_NO, title: "No" }]
  )

  return conversation
}

async function offerOpenSlots(phone: string, branch: string) {
  const slots = await db.appointmentSlot.findMany({
    where: { status: "OPEN", branch, startAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
    take: 10,
  })

  if (slots.length === 0) {
    await sendWhatsAppText(phone, "There are no appointment slots open for your area right now — one of our team members will reach out directly to schedule.")
    return
  }

  await sendWhatsAppList(
    phone,
    `Great — here are the available appointment times for ${branch}:`,
    "Pick a time",
    slots.map((s) => ({ id: s.id, title: formatSlotTime(s.startAt) }))
  )
}

async function handleValidation(conversation: { id: string; phone: string; leadId: string | null }, message: InboundMessage) {
  const id = replyId(message)
  if (id === VALIDATE_YES) {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { state: "AWAITING_BRANCH" } })
    await sendWhatsAppText(conversation.phone, `Which state are you located in? (e.g. ${MALAYSIA_STATES[0]}, ${MALAYSIA_STATES[1]})`)
    return
  }
  if (id === VALIDATE_NO) {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { state: "DECLINED" } })
    if (conversation.leadId) {
      await db.lead.update({ where: { id: conversation.leadId }, data: { status: "CLOSED_LOST" } })
      await db.leadStatusHistory.create({ data: { leadId: conversation.leadId, from: "NEW", to: "CLOSED_LOST", changedById: null } })
      await db.leadNote.create({ data: { leadId: conversation.leadId, authorId: null, isSystem: true, content: "Declined via WhatsApp validation." } })
    }
    await sendWhatsAppText(conversation.phone, "No problem — thanks for your time!")
    return
  }
  // Anything else (stray text, etc.) — reprompt with the buttons again.
  await sendWhatsAppButtons(
    conversation.phone,
    "Sorry, please tap one of the buttons below — are you interested in a vending machine partnership?",
    [{ id: VALIDATE_YES, title: "Yes" }, { id: VALIDATE_NO, title: "No" }]
  )
}

async function handleBranch(conversation: { id: string; phone: string; leadId: string | null }, message: InboundMessage) {
  const raw = message.text?.body
  const branch = resolveStateBranch(raw)
  if (!branch) {
    await sendWhatsAppText(conversation.phone, `Sorry, I didn't recognize that state — try again (e.g. ${MALAYSIA_STATES[0]}, ${MALAYSIA_STATES[1]}, ${MALAYSIA_STATES[2]}).`)
    return
  }
  await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { branch, state: "AWAITING_SLOT" } })
  if (conversation.leadId) {
    await db.lead.update({ where: { id: conversation.leadId }, data: { branch } })
  }
  await offerOpenSlots(conversation.phone, branch)
}

async function handleSlotSelection(conversation: { id: string; phone: string; leadId: string | null; branch: string | null }, message: InboundMessage) {
  const slotId = replyId(message)
  if (!slotId || !conversation.branch) {
    await sendWhatsAppText(conversation.phone, "Please pick a time from the list.")
    if (conversation.branch) await offerOpenSlots(conversation.phone, conversation.branch)
    return
  }

  const booked = await db.appointmentSlot.updateMany({
    where: { id: slotId, status: "OPEN" },
    data: { status: "BOOKED", leadId: conversation.leadId },
  })

  if (booked.count === 0) {
    // Someone else booked it first, or it was cancelled — offer what's still open.
    await sendWhatsAppText(conversation.phone, "Sorry, that slot was just taken.")
    await offerOpenSlots(conversation.phone, conversation.branch)
    return
  }

  const slot = await db.appointmentSlot.findUnique({ where: { id: slotId } })
  await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { state: "BOOKED" } })
  await sendWhatsAppText(
    conversation.phone,
    `You're booked for ${slot ? formatSlotTime(slot.startAt) : "your selected time"}. A team member will confirm with you shortly. Thank you!`
  )
}

export async function handleInboundWhatsAppMessage(message: InboundMessage) {
  const phone = message.from
  let conversation = await db.whatsAppConversation.findUnique({ where: { phone } })

  if (!conversation) {
    conversation = await startConversation(phone, message.referral)
    return
  }

  switch (conversation.state) {
    case "AWAITING_VALIDATION":
      await handleValidation(conversation, message)
      break
    case "AWAITING_BRANCH":
      await handleBranch(conversation, message)
      break
    case "AWAITING_SLOT":
      await handleSlotSelection(conversation, message)
      break
    default:
      // BOOKED / DECLINED — conversation already finished, nothing further to automate.
      break
  }
}
