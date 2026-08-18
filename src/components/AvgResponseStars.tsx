import { formatAvgResponseTime } from "@/lib/responseTime"

// Sales response-time research shows the drop-off is steep at the low end (contacting
// a lead in the first few minutes converts dramatically better than even a 30-minute
// delay), so the bands are weighted toward that curve rather than spaced evenly. 15min
// and 1hr/4hr line up with the color thresholds this replaced.
function starsFor(avgMs: number): number {
  const mins = avgMs / 60000
  if (mins < 15) return 5
  if (mins < 60) return 4
  if (mins < 240) return 3
  if (mins < 1440) return 2
  return 1
}

const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className={filled ? "text-amber-400" : "text-gray-200"}>
      <path d={STAR_PATH} />
    </svg>
  )
}

export default function AvgResponseStars({ avgResponseMs }: { avgResponseMs: number | null }) {
  if (avgResponseMs === null) {
    return <span className="text-xs text-gray-300">—</span>
  }
  const stars = starsFor(avgResponseMs)
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-0.5" title={`${stars}/5`}>
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} filled={i <= stars} />)}
      </div>
      <span className="text-[11px] text-gray-400">{formatAvgResponseTime(avgResponseMs)}</span>
    </div>
  )
}
