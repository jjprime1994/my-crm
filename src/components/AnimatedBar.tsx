"use client"

import { useEffect, useState } from "react"

export default function AnimatedBar({ pct, className }: { pct: number; className: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  return (
    <div
      className={`h-full rounded-full transition-[width] duration-700 ease-out ${className}`}
      style={{ width: `${width}%` }}
    />
  )
}
