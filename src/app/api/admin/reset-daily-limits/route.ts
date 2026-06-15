import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { sendPushToUser } from "@/lib/push"

export async function POST() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowInMYT = Date.now() + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)

  const { count } = await db.lead.updateMany({
    where: { claimedAt: { gte: startOfDayUTC } },
    data: { claimedAt: null },
  })

  const users = await db.user.findMany({ select: { id: true } })
  await Promise.allSettled(
    users.map((u) =>
      sendPushToUser(u.id, {
        title: "New leads in the pool!",
        body: "Daily limits refreshed — first come first served!",
        url: "/available-leads",
      })
    )
  )

  return NextResponse.json({ reset: count })
}
