import { db } from "@/lib/db"
import type { LeadStatus } from "@/generated/prisma/client"

const STALE_DAYS = 30
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000
const ACTIVE_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"]

// The claimed-lead sweep launched to a ~5,060-lead backlog (most of the team, spread
// across nearly every salesperson) — closing that in one shot the same night the
// reminder banner ships would blindside everyone. Give people a week to see the
// banner and touch their own stale leads before enforcement actually starts; the
// unclaimed sweep has no such backlog problem (only ~99 leads) so isn't graced.
export const CLAIMED_SWEEP_GRACE_UNTIL = new Date("2026-08-25T21:00:00.000Z") // 5am MYT, 26 Aug

async function closeLeads(leadIds: { id: string; status: LeadStatus }[], reason: string): Promise<string[]> {
  const closed: string[] = []
  for (const lead of leadIds) {
    await db.lead.update({ where: { id: lead.id }, data: { status: "CLOSED_LOST" } })
    await db.leadStatusHistory.create({
      data: { leadId: lead.id, from: lead.status, to: "CLOSED_LOST", changedById: null },
    })
    await db.leadNote.create({
      data: { leadId: lead.id, authorId: null, isSystem: true, content: reason },
    })
    closed.push(lead.id)
  }
  return closed
}

// Auto-closes leads nobody has claimed and that have sat in the pool for 30+ days.
// "Unclaimed" = still sitting in the available pool (assignedToId null).
//
// Keyed off createdAt, not updatedAt: an unclaimed lead's updatedAt can get bumped
// by things that aren't real engagement (state/routing corrections, backfills,
// migrations) and reset its clock without anyone ever having touched it — an
// admin state-correction on 4 Aug 2026 did exactly that to ~100 leads at once,
// which is why the cron found zero candidates despite leads visibly sitting
// unclaimed for 30+ days in Available Leads (which displays createdAt). Since
// nothing legitimate happens to an unclaimed lead other than being claimed
// (which removes it from this query entirely), createdAt is the only clock that
// actually means "how long has this been sitting here."
export async function closeStaleUnclaimedLeads(): Promise<{ closedCount: number; leadIds: string[] }> {
  const cutoff = new Date(Date.now() - STALE_MS)

  const candidates = await db.lead.findMany({
    where: { assignedToId: null, status: { in: ACTIVE_STATUSES }, createdAt: { lt: cutoff } },
    select: { id: true, status: true },
  })

  const leadIds = await closeLeads(candidates, `Auto-closed as Lost: unclaimed and untouched for ${STALE_DAYS}+ days.`)
  return { closedCount: leadIds.length, leadIds }
}

// Auto-closes leads someone claimed but hasn't touched in 30+ days — a claimed lead
// going quiet already surfaces as the "Stale" badge (same updatedAt signal, 48h
// threshold) on Team Breakdown, this just acts on it once it's been quiet a full
// month instead of only flagging it. Ownership (assignedToId) is left alone, and
// nothing prevents changing status again later — e.g. back to Won if the deal
// closes after all — this is just Lost-by-default, not a lock.
//
// Requires BOTH no updatedAt change AND no note logged in 30 days: a salesperson
// can genuinely be working a relationship by phone/WhatsApp and only logging plain
// notes, which don't bump updatedAt (see notes route) — updatedAt alone flagged
// ~5,150 leads, most likely still-active ones just not reflected by that one
// field. Requiring silence on both signals is a much stronger "actually dead" bar.
export async function closeStaleClaimedLeads(): Promise<{ closedCount: number; leadIds: string[] }> {
  if (Date.now() < CLAIMED_SWEEP_GRACE_UNTIL.getTime()) return { closedCount: 0, leadIds: [] }

  const cutoff = new Date(Date.now() - STALE_MS)

  const candidates = await db.lead.findMany({
    where: {
      assignedToId: { not: null },
      status: { in: ACTIVE_STATUSES },
      updatedAt: { lt: cutoff },
      notes: { none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true, status: true },
  })

  const leadIds = await closeLeads(candidates, `Auto-closed as Lost: claimed but untouched for ${STALE_DAYS}+ days.`)
  return { closedCount: leadIds.length, leadIds }
}
