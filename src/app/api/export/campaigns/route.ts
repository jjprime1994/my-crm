import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/roles"
import { getCampaignPerformance } from "@/lib/campaign-stats"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const dateFrom = req.nextUrl.searchParams.get("dateFrom")
  const dateTo = req.nextUrl.searchParams.get("dateTo")
  let since: Date | null
  let until: Date | null = null
  if (dateFrom || dateTo) {
    since = dateFrom ? new Date(`${dateFrom}T00:00:00+08:00`) : null
    until = dateTo ? new Date(`${dateTo}T23:59:59+08:00`) : null
  } else {
    const days = Number(req.nextUrl.searchParams.get("period") ?? 30)
    since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  }

  const { campaigns } = await getCampaignPerformance(since, until)

  const headers = ["Campaign", "Leads", "Claimed", "Unclaimed", "Won", "Lost", "Conversion %"]

  const rows = campaigns.map((c) => [
    c.name,
    c.total,
    c.claimed,
    c.unclaimed,
    c.won,
    c.lost,
    c.conversion,
  ])

  const sanitize = (cell: string) => {
    const s = String(cell)
    // Prefix formula-triggering characters to prevent Excel injection
    return /^[=+\-@]/.test(s) ? `\t${s}` : s
  }

  const csv = "﻿" + [headers, ...rows]
    .map((row) => row.map((cell) => `"${sanitize(String(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaign-performance-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
