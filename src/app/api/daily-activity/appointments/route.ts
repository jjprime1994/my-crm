import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { isDateStr, parseAppointmentBody, todayMYT } from "@/lib/commission"
import { syncAppointmentCount } from "@/lib/daily-appointments"

// POST: add one appointment for a person/day. Body: { userId?, date, source, sourceOther?, customerName? }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })

  const body = await req.json().catch(() => ({}))
  const userId: string = body.userId || session.user.id
  const date = body.date
  if (!isDateStr(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 })
  if (date > todayMYT()) return NextResponse.json({ error: "Can't enter appointments for a future date." }, { status: 400 })

  const parsed = parseAppointmentBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (!(await canManageUser(session.user.id, session.user.role, userId))) {
    return NextResponse.json({ error: "You can't edit entries for this person." }, { status: 403 })
  }

  const result = await db.$transaction(async (tx) => {
    const appt = await tx.dailyAppointment.create({ data: { ...parsed.data, userId, date, createdById: session.user.id } })
    const appointmentsCount = await syncAppointmentCount(tx, userId, date, session.user.id)
    return { appointment: { id: appt.id, source: appt.source, sourceOther: appt.sourceOther, customerName: appt.customerName }, appointmentsCount }
  })
  return NextResponse.json(result)
}
