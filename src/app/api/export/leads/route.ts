import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { LeadStatus } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const statuses = searchParams.getAll("status") as LeadStatus[]
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const adName = searchParams.get("adName")

  const where: Record<string, unknown> = {}
  if (statuses.length > 0) where.status = { in: statuses }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
    }
  }
  if (adName) where.adName = adName

  const leads = await db.lead.findMany({
    where,
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const headers = [
    "First Name", "Last Name", "Email", "Phone",
    "Status", "Ad / Form", "Campaign", "Assigned To", "Created Date",
  ]

  const rows = leads.map((l) => [
    l.firstName ?? "",
    l.lastName ?? "",
    l.email ?? "",
    l.phone ?? "",
    l.status,
    l.adName ?? "",
    l.campaignName ?? "",
    l.assignedTo?.name ?? "Unassigned",
    new Date(l.createdAt).toLocaleDateString("en-MY"),
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
