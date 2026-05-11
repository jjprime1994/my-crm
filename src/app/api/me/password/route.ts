import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) return new NextResponse("Missing fields", { status: 400 })
  if (newPassword.length < 8) return new NextResponse("Password must be at least 8 characters", { status: 400 })

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) return new NextResponse("User not found", { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return new NextResponse("Current password is incorrect", { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({ where: { id: session.user.id }, data: { password: hashed } })

  return new NextResponse(null, { status: 204 })
}
