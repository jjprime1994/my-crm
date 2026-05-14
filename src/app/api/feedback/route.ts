export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isManagerLevel } from "@/lib/roles"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const admin = isManagerLevel(session.user.role)

  const suggestions = await db.suggestion.findMany({
    where: admin ? undefined : { userId: session.user.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(suggestions)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { type, title, description } = await req.json()
  if (!title?.trim() || !description?.trim()) {
    return new NextResponse("Title and description are required", { status: 400 })
  }

  const suggestion = await db.suggestion.create({
    data: {
      userId: session.user.id,
      type: type === "BUG" ? "BUG" : "SUGGESTION",
      title: title.trim(),
      description: description.trim(),
    },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(suggestion, { status: 201 })
}
