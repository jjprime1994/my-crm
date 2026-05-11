import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  if (id === session.user.id) return new NextResponse("Cannot delete yourself", { status: 400 })
  await db.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })
  const { id } = await params
  const { claimLimit } = await req.json()
  const user = await db.user.update({
    where: { id },
    data: { claimLimit: Number(claimLimit) },
    select: { id: true, name: true, claimLimit: true },
  })
  return NextResponse.json(user)
}
