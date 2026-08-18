"use client"

import { useCallback, useRef } from "react"

// Preserves the user's visual scroll position across a reorder/filter of a long list —
// without this, resorting a table the user has scrolled into feels like it "jumps to the
// top": scrollHeight barely changes, but the rows that shift above the old scroll offset
// push everything else to a different pixel position, so the visible content changes even
// though the raw scrollTop didn't move much.
//
// Usage: call `capture()` synchronously at the top of the handler that triggers the
// reorder (before the state update), then call `restore()` in a useLayoutEffect that runs
// after the reorder's re-render. Rows must carry a `data-row-id` attribute to be found.
export function useScrollAnchor() {
  const anchor = useRef<{ id: string; offset: number } | null>(null)

  const capture = useCallback(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-row-id]")
    for (const row of Array.from(rows)) {
      const rect = row.getBoundingClientRect()
      if (rect.bottom > 0) {
        anchor.current = { id: row.dataset.rowId!, offset: rect.top }
        return
      }
    }
    anchor.current = null
  }, [])

  const restore = useCallback(() => {
    const captured = anchor.current
    if (!captured) return
    const el = document.querySelector<HTMLElement>(`[data-row-id="${captured.id}"]`)
    if (el) {
      const delta = el.getBoundingClientRect().top - captured.offset
      if (delta !== 0) (el.closest("main") ?? document.scrollingElement)?.scrollBy(0, delta)
    }
    anchor.current = null
  }, [])

  return { capture, restore }
}
