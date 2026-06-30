import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

async function findViolations() {
  const leads = await db.lead.findMany({
    where: { assignedToId: { not: null }, branch: { not: null } },
    select: {
      id: true,
      branch: true,
      firstName: true,
      lastName: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          role: true,
          coveredStates: true,
          manager: {
            select: {
              id: true,
              name: true,
              role: true,
              coveredStates: true,
              manager: { select: { id: true, name: true, role: true, coveredStates: true } },
            },
          },
        },
      },
    },
  })

  type Violation = { leadId: string; leadName: string; leadBranch: string; salesperson: string; salespersonId: string; teamCoveredStates: string[] }
  const violations: Violation[] = []

  for (const lead of leads) {
    if (!lead.assignedTo) continue
    const sp = lead.assignedTo
    let coveredStates: string[] = []
    if (sp.role === "ADMIN" || sp.role === "SUPER_ADMIN") {
      coveredStates = sp.coveredStates
    } else if (sp.manager) {
      const mgr = sp.manager
      if (mgr.role === "ADMIN" || mgr.role === "SUPER_ADMIN") coveredStates = mgr.coveredStates
      else if (mgr.manager && (mgr.manager.role === "ADMIN" || mgr.manager.role === "SUPER_ADMIN")) coveredStates = mgr.manager.coveredStates
    }
    if (coveredStates.length > 0 && lead.branch && !coveredStates.includes(lead.branch)) {
      violations.push({ leadId: lead.id, leadName: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "(no name)", leadBranch: lead.branch, salesperson: sp.name ?? sp.id, salespersonId: sp.id, teamCoveredStates: coveredStates })
    }
  }
  return violations
}

async function auth_check(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")
  if (key === process.env.BACKFILL_SECRET) return true
  const session = await auth()
  return session && isSuperAdmin(session.user.role)
}

export async function GET(req: NextRequest) {
  if (!await auth_check(req)) return new NextResponse("Forbidden", { status: 403 })

  const violations = await findViolations()
  const bySalesperson: Record<string, { name: string; coveredStates: string[]; count: number; states: string[] }> = {}
  for (const v of violations) {
    if (!bySalesperson[v.salespersonId]) bySalesperson[v.salespersonId] = { name: v.salesperson, coveredStates: v.teamCoveredStates, count: 0, states: [] }
    bySalesperson[v.salespersonId].count++
    if (!bySalesperson[v.salespersonId].states.includes(v.leadBranch)) bySalesperson[v.salespersonId].states.push(v.leadBranch)
  }
  return NextResponse.json({ totalViolations: violations.length, affectedSalespeople: Object.keys(bySalesperson).length, bySalesperson: Object.values(bySalesperson).sort((a, b) => b.count - a.count) })
}

export async function POST(req: NextRequest) {
  if (!await auth_check(req)) return new NextResponse("Forbidden", { status: 403 })

  const violations = await findViolations()
  if (violations.length === 0) return NextResponse.json({ unassigned: 0 })

  await db.lead.updateMany({
    where: { id: { in: violations.map((v) => v.leadId) } },
    data: { assignedToId: null, claimedById: null, claimedAt: null },
  })

  return NextResponse.json({ unassigned: violations.length })
}
