import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/roles"
import { getCampaignPerformance } from "@/lib/campaign-stats"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const days = Number(req.nextUrl.searchParams.get("period") ?? 30)
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null

  const { campaigns } = await getCampaignPerformance(since)

  const headers = [
    "Campaign", "Status", "Daily Budget (RM)", "Today Spend (RM)", "Period Spend (RM)", "CPL (RM)",
    "Leads", "Claimed", "Unclaimed", "Won", "Lost", "Conversion %",
  ]

  const rows = campaigns.map((c) => [
    c.name,
    c.status ?? "",
    c.dailyBudget !== null ? c.dailyBudget.toFixed(2) : "",
    c.spendToday !== null ? c.spendToday.toFixed(2) : "",
    c.spendPeriod !== null ? c.spendPeriod.toFixed(2) : "",
    c.cpl !== null ? c.cpl.toFixed(2) : "",
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
