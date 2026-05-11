import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/roles"
import bcrypt from "bcryptjs"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  if (id === session.user.id) return new NextResponse("Cannot delete yourself", { status: 400 })
  await db.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  const body = await req.json()

  if ("newPassword" in body) {
    if (!body.newPassword || body.newPassword.length < 8)
      return new NextResponse("Password must be at least 8 characters", { status: 400 })
    const hashed = await bcrypt.hash(body.newPassword, 12)
    await db.user.update({ where: { id }, data: { password: hashed } })
    return new NextResponse(null, { status: 204 })
  }

  const { claimLimit } = body
  const user = await db.user.update({
    where: { id },
    data: { claimLimit: Number(claimLimit) },
    select: { id: true, name: true, claimLimit: true },
  })
  return NextResponse.json(user)
}
