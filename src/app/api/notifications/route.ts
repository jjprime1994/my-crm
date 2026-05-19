import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const userId = session.user.id
  const role = session.user.role

  // End of today (MYT = UTC+8)
  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowInMYT = Date.now() + MYT_OFFSET
  const endOfTodayMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000)) + 24 * 60 * 60 * 1000
  const endOfTodayUTC = new Date(endOfTodayMYT - MYT_OFFSET)

  const followUps = await db.lead.findMany({
    where: {
      assignedToId: userId,
      followUpAt: { lte: endOfTodayUTC, not: null },
      status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
    },
    select: { id: true, firstName: true, lastName: true, followUpAt: true },
    orderBy: { followUpAt: "asc" },
    take: 20,
  })

  return NextResponse.json({ followUps })
}
