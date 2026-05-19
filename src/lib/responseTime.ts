export type ResponseTimeBadge = {
  label: string
  colorClass: string
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
