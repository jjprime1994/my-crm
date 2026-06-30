import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

// Bootstrap endpoint: POST /api/seed with { secret, name, email, password }
// Only works when zero users exist in the database (first-run only).
export async function POST(req: NextRequest) {
  const userCount = await db.user.count()
  if (userCount > 0) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const { secret, name, email, password } = await req.json()

  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name, email, password: hashed, role: "ADMIN" },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json(user, { status: 201 })
}
