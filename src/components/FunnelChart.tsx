"use client"

import AnimatedBar from "@/components/AnimatedBar"

// Single hue, monotone lightness — reads as "position in a sequence," not four
// unrelated categories. Won/Lost are exits that can branch off any stage, not
// a fifth rung on this ladder, so they're shown separately as status badges.
const STAGE_COLORS = ["bg-violet-400", "bg-violet-500", "bg-violet-600", "bg-violet-800"]

export type FunnelStage = { label: string; count: number }

interface Props {
  stages: FunnelStage[] // in sequence order, e.g. New -> Contacted -> Qualified -> Appointment Made
  won: number
  lost: number
  total: number
}

export default function FunnelChart({ stages, won, lost, total }: Props) {
  const base = stages[0]?.count ?? 0

  return (
    <div className="px-6 py-5 border-b border-gray-50">
      <div className="flex flex-col gap-1">
        {stages.map((stage, i) => {
          const shareOfStart = base > 0 ? Math.round((stage.count / base) * 100) : 0
          const barPct = base > 0 ? Math.max((stage.count / base) * 100, stage.count > 0 ? 2 : 0) : 0
          const prev = i > 0 ? stages[i - 1] : null
          const retained = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null

          return (
            <div key={stage.label}>
              {prev && (
                <div className="flex items-center gap-2 pl-1 py-0.5" title={`${stage.count} of ${prev.count} ${prev.label} leads went on to ${stage.label}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" className="shrink-0">
                    <polyline points="19 12 12 19 5 12" />
                    <line x1="12" y1="19" x2="12" y2="5" />
                  </svg>
                  <span className="text-xs text-gray-400">{retained !== null ? `${retained}% continued` : "—"}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm text-gray-600 truncate">{stage.label}</span>
                <div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden">
                  <AnimatedBar pct={barPct} className={STAGE_COLORS[i] ?? "bg-violet-600"} />
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-semibold text-gray-900">{stage.count}</span>
                <span className="w-12 shrink-0 text-right text-xs text-gray-400">{shareOfStart}%</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Outcomes</span>
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-emerald-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          Won {won} ({total > 0 ? Math.round((won / total) * 100) : 0}%)
        </div>
        <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-rose-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Lost {lost} ({total > 0 ? Math.round((lost / total) * 100) : 0}%)
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total} total leads</span>
      </div>
    </div>
  )
}
