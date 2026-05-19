import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin, isManagerLevel } from "@/lib/roles"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { claimLimit } = await req.json()
  if (typeof claimLimit !== "number" || claimLimit < 1 || claimLimit > 500) {
    return new NextResponse("Invalid claimLimit", { status: 400 })
  }

  await db.user.updateMany({
    where: { role: { notIn: ["SUPER_ADMIN"] } },
    data: { claimLimit },
  })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isManagerLevel(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { name, email, password, role } = await req.json()

  if (!name || !email || !password) {
    return new NextResponse("Missing fields", { status: 400 })
  }

  const requestedRole = role ?? "SALESPERSON"

  // Only SUPER_ADMIN can create managers
  if (requestedRole === "ADMIN" && !isSuperAdmin(session.user.role)) {
    return new NextResponse("Only Super Admin can create managers", { status: 403 })
  }
  // Only ADMIN (or super admin) can create team leaders
  if (requestedRole === "TEAM_LEADER" && !isAdmin(session.user.role)) {
    return new NextResponse("Only managers can create team leaders", { status: 403 })
  }

  const hashed = await bcrypt.hash(password, 12)

  // Auto-assign managerId for non-super-admin creating salesperson or team leader
  const managerId =
    !isSuperAdmin(session.user.role) && ["SALESPERSON", "TEAM_LEADER"].includes(requestedRole)
      ? session.user.id
      : undefined

  const user = await db.user.create({
    data: { name, email, password: hashed, role: requestedRole, managerId },
    select: {
      id: true, name: true, email: true, role: true,
      claimLimit: true, newLeadThreshold: true, managerId: true, createdAt: true,
      _count: { select: { leads: true } },
    },
  })

  return NextResponse.json(user, { status: 201 })
}
