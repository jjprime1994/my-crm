import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin } from "@/lib/roles"
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

// Create a new salesperson (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { name, email, password, role } = await req.json()

  if (!name || !email || !password) {
    return new NextResponse("Missing fields", { status: 400 })
  }

  // Only SUPER_ADMIN can create managers
  const requestedRole = role ?? "SALESPERSON"
  if (requestedRole === "ADMIN" && !isSuperAdmin(session.user.role)) {
    return new NextResponse("Only Super Admin can create managers", { status: 403 })
  }

  const hashed = await bcrypt.hash(password, 12)

  // When a manager creates a salesperson, auto-assign to their team
  const managerId = !isSuperAdmin(session.user.role) && requestedRole === "SALESPERSON"
    ? session.user.id
    : undefined

  const user = await db.user.create({
    data: { name, email, password: hashed, role: requestedRole, managerId },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json(user, { status: 201 })
}
