import { db } from "@/lib/db"
import { sendPushToUsers, sendPushToSuperAdmins } from "@/lib/push"

// On Vercel Hobby, cron can only run once/day (see vercel.json) — so "reminder"
// here means "flag anything due today" run each morning, not "N hours before."
// Both sweeps are idempotent (reminderSentAt guard; MISSED is terminal), so
// tightening the cadence later (Pro's per-minute crons, or an external scheduler
// hitting /api/cron/check-appointments more often) is a schedule change only.

async function eligibleUserIdsForBranch(branch: string): Promise<string[]> {
  const [stateRouteUsers, managers] = await Promise.all([
    db.stateRoute.findFirst({ where: { state: branch }, select: { userIds: true } }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN", "TEAM_LEADER"] }, OR: [{ coveredStates: { has: branch } }, { isDefaultTeam: true }] },
      select: { id: true },
    }),
  ])
  return [...new Set([...(stateRouteUsers?.userIds ?? []), ...managers.map((m) => m.id)])]
}

// Flags BOOKED slots due today (MYT) or earlier that haven't been reminded about yet.
export async function flagUnclaimedAppointments(): Promise<{ flaggedCount: number; slotIds: string[] }> {
  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowInMYT = Date.now() + MYT_OFFSET
  const endOfTodayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000)) + 24 * 60 * 60 * 1000
  const endOfTodayUTC = new Date(endOfTodayInMYT - MYT_OFFSET)

  const slots = await db.appointmentSlot.findMany({
    where: { status: "BOOKED", startAt: { lt: endOfTodayUTC }, reminderSentAt: null },
  })

  const slotIds: string[] = []
  for (const slot of slots) {
    const userIds = await eligibleUserIdsForBranch(slot.branch)
    if (userIds.length > 0) {
      await sendPushToUsers(userIds, {
        title: "📅 Unclaimed appointment today",
        body: `${slot.branch} — ${slot.startAt.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })} MYT still unclaimed.`,
        url: "/available-appointments",
      })
    }
    await db.appointmentSlot.update({ where: { id: slot.id }, data: { reminderSentAt: new Date() } })
    slotIds.push(slot.id)
  }

  return { flaggedCount: slotIds.length, slotIds }
}

// Marks BOOKED slots whose start time has passed as MISSED — nobody claimed it in time.
export async function closeMissedAppointments(): Promise<{ missedCount: number; slotIds: string[] }> {
  const slots = await db.appointmentSlot.findMany({ where: { status: "BOOKED", startAt: { lt: new Date() } } })
  if (slots.length === 0) return { missedCount: 0, slotIds: [] }

  const slotIds = slots.map((s) => s.id)
  await db.appointmentSlot.updateMany({ where: { id: { in: slotIds } }, data: { status: "MISSED" } })

  const leadIds = slots.map((s) => s.leadId).filter((id): id is string => id !== null)
  if (leadIds.length > 0) {
    await db.leadNote.createMany({
      data: leadIds.map((leadId) => ({
        leadId, authorId: null, isSystem: true,
        content: "Appointment slot missed — nobody claimed it before the scheduled time.",
      })),
    })
  }

  await sendPushToSuperAdmins({
    title: "⚠️ Appointment(s) missed",
    body: `${slots.length} appointment${slots.length !== 1 ? "s" : ""} passed unclaimed and ${slots.length !== 1 ? "were" : "was"} marked missed.`,
    url: "/superadmin/appointments",
  })

  return { missedCount: slotIds.length, slotIds }
}
