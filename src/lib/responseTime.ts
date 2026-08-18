export type ResponseTimeBadge = {
  label: string
  colorClass: string
}

// "Business hours" for response-time purposes: 9am-11pm MYT, every day. A lead claimed
// or sitting unworked outside this window shouldn't count against a salesperson who
// genuinely can't reach a sleeping customer — so only the portion of the claim-to-contact
// gap that overlaps this window counts as elapsed response time.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const BUSINESS_START_MS = 9 * 60 * 60 * 1000
const BUSINESS_END_MS = 23 * 60 * 60 * 1000

export function businessMsElapsed(claimedAt: Date | string, firstContactedAt: Date | string): number {
  const fromMs = new Date(claimedAt).getTime()
  const toMs = new Date(firstContactedAt).getTime()
  if (toMs <= fromMs) return 0

  let elapsed = 0
  let mytMidnight = Math.floor((fromMs + MYT_OFFSET_MS) / DAY_MS) * DAY_MS - MYT_OFFSET_MS
  while (mytMidnight < toMs) {
    const dayStart = mytMidnight + BUSINESS_START_MS
    const dayEnd = mytMidnight + BUSINESS_END_MS
    const overlapStart = Math.max(fromMs, dayStart)
    const overlapEnd = Math.min(toMs, dayEnd)
    if (overlapEnd > overlapStart) elapsed += overlapEnd - overlapStart
    mytMidnight += DAY_MS
  }
  return elapsed
}

export function calcResponseTime(
  claimedAt: Date | string | null | undefined,
  firstContactedAt: Date | string | null | undefined
): ResponseTimeBadge | null {
  if (!claimedAt || !firstContactedAt) return null
  const ms = new Date(firstContactedAt).getTime() - new Date(claimedAt).getTime()
  if (ms < 0) return null

  const mins = Math.round(ms / 60000)
  let label: string
  if (mins < 60) {
    label = `${mins}m`
  } else {
    const hours = Math.floor(mins / 60)
    if (hours < 24) {
      label = mins % 60 > 0 ? `${hours}h ${mins % 60}m` : `${hours}h`
    } else {
      const days = Math.floor(hours / 24)
      label = `${days}d ${hours % 24}h`
    }
  }

  const colorClass =
    mins < 60
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : mins < 240
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"

  return { label, colorClass }
}

export function formatAvgResponseTime(avgMs: number | null): string {
  if (avgMs === null) return "—"
  const mins = Math.round(avgMs / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
