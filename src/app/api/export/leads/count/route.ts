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
  const platform = searchParams.get("platform")
  const branch = searchParams.get("branch")
  const assigned = searchParams.get("assigned")
  const excludeDuplicates = searchParams.get("excludeDuplicates") === "true"
  const managerId = searchParams.get("managerId")

  const where: Record<string, unknown> = {}
  if (statuses.length > 0) where.status = { in: statuses }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
    }
  }
  if (adName) where.adName = adName
  if (platform) where.source = platform
  if (branch) where.branch = branch
  if (assigned === "true") where.assignedToId = { not: null }
  if (assigned === "false") where.assignedToId = null
  if (excludeDuplicates) where.isDuplicate = false
  if (managerId) {
    const members = await db.user.findMany({ where: { managerId }, select: { id: true } })
    const ids = members.map((m) => m.id)
    where.assignedToId = { in: ids.length > 0 ? ids : ["__none__"] }
  }

  const count = await db.lead.count({ where })
  return NextResponse.json({ count })
}
