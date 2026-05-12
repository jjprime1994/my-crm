import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) return new NextResponse("Invalid subscription", { status: 400 })

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
  })

  return new NextResponse(null, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { endpoint } = await req.json()
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } })
  return new NextResponse(null, { status: 204 })
}
