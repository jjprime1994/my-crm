"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ResetLimitsButton() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const router = useRouter()

  async function handleReset() {
    setState("loading")
    await fetch("/api/admin/reset-daily-limits", { method: "POST" })
    setState("done")
    router.refresh()
    setTimeout(() => setState("idle"), 4000)
  }

  if (state === "done") {
    return (
      <p className="text-xs font-medium text-emerald-500 mt-0.5">
        ✓ Limits reset &amp; notification sent
      </p>
    )
  }

  return (
    <button
      onClick={handleReset}
      disabled={state === "loading"}
      className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50 mt-0.5 text-left"
    >
      {state === "loading" ? "Resetting…" : "Reset all limits →"}
    </button>
  )
}
