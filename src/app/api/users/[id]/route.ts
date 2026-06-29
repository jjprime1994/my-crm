import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel, isSuperAdmin, isTeamLeader } from "@/lib/roles"
import { Role } from "@/generated/prisma/client"
import bcrypt from "bcryptjs"

const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 4, ADMIN: 3, TEAM_LEADER: 2, SALESPERSON: 1 }

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isManagerLevel(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  if (id === session.user.id) return new NextResponse("Cannot delete yourself", { status: 400 })

  const target = await db.user.findUnique({ where: { id }, select: { managerId: true, role: true } })
  if (!target) return new NextResponse("Not found", { status: 404 })

  // Cannot delete a user of equal or higher rank (prevents ADMIN deleting SUPER_ADMIN)
  if ((ROLE_RANK[target.role] ?? 0) >= (ROLE_RANK[session.user.role] ?? 0)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // Team leaders can only delete their own direct reports
  if (isTeamLeader(session.user.role)) {
    if (target.managerId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })
  }

  await db.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isManagerLevel(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  const body = await req.json()

  const target = await db.user.findUnique({ where: { id }, select: { managerId: true, role: true } })
  if (!target) return new NextResponse("Not found", { status: 404 })

  // Cannot modify a user of equal or higher rank unless editing yourself
  // (prevents ADMIN resetting SUPER_ADMIN password, etc.)
  if (id !== session.user.id && (ROLE_RANK[target.role] ?? 0) >= (ROLE_RANK[session.user.role] ?? 0)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // Team leaders can only patch their own direct reports
  if (isTeamLeader(session.user.role)) {
    if (target.managerId !== session.user.id) return new NextResponse("Forbidden", { status: 403 })
  }

  if ("newPassword" in body) {
    if (!body.newPassword || body.newPassword.length < 8)
      return new NextResponse("Password must be at least 8 characters", { status: 400 })
    const hashed = await bcrypt.hash(body.newPassword, 12)
    await db.user.update({ where: { id }, data: { password: hashed } })
    return new NextResponse(null, { status: 204 })
  }

  const data: Record<string, unknown> = {}
  if ("name" in body) {
    if (!body.name?.trim()) return new NextResponse("Name is required", { status: 400 })
    data.name = body.name.trim()
  }
  if ("claimLimit" in body) data.claimLimit = Number(body.claimLimit)
  if ("newLeadThreshold" in body) data.newLeadThreshold = Number(body.newLeadThreshold)
  if ("managerId" in body) {
    if (!isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
    data.managerId = body.managerId || null
  }
  if ("role" in body) {
    if (!isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
    if (!["SALESPERSON", "TEAM_LEADER", "ADMIN", "SUPER_ADMIN"].includes(body.role))
      return new NextResponse("Invalid role", { status: 400 })
    data.role = body.role as Role
  }
  if ("coveredStates" in body) {
    if (!isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
    data.coveredStates = Array.isArray(body.coveredStates) ? body.coveredStates : []
  }

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, claimLimit: true, newLeadThreshold: true, role: true },
  })
  return NextResponse.json(user)
}
