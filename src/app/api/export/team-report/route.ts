import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/roles"
import { getTeamReport } from "@/lib/team-report"
import { formatAvgResponseTime } from "@/lib/responseTime"
import { LeadStatus } from "@/generated/prisma/client"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Manager", TEAM_LEADER: "Team Leader", SALESPERSON: "Salesperson",
}

const STAGE_LABELS: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Appointment Made", CLOSED_WON: "Won", CLOSED_LOST: "Lost",
}

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

  let rows = await getTeamReport(since, until)

  const teamsParam = req.nextUrl.searchParams.get("teams")
  if (teamsParam) {
    const selectedTeamIds = new Set(teamsParam.split(","))
    rows = rows.filter((r) => selectedTeamIds.has(r.teamId))
  }

  // Qualified was removed from the active pipeline (New -> Contacted -> Appointment Made -> Won/Lost)
  const stages: LeadStatus[] = ["NEW", "CONTACTED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"]
  const headers = ["Team", "Member", "Role", "Leads Taken", ...stages.map((s) => STAGE_LABELS[s]), "Avg Response Time", "Not Contacted"]
  const csvRows = rows.map((r) => [
    r.team,
    r.name,
    ROLE_LABELS[r.role],
    r.claimed,
    ...stages.map((s) => r.statusCounts[s]),
    formatAvgResponseTime(r.avgResponseMs),
    r.notContacted,
  ])

  const sanitize = (cell: string) => {
    const s = String(cell)
    // Prefix formula-triggering characters to prevent Excel injection
    return /^[=+\-@]/.test(s) ? `\t${s}` : s
  }

  const csv = "﻿" + [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${sanitize(String(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="team-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
