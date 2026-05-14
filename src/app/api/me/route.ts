import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return new NextResponse("Name is required", { status: 400 })

  await db.user.update({ where: { id: session.user.id }, data: { name: name.trim() } })

  return new NextResponse(null, { status: 204 })
}
