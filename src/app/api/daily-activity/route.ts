import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { isDateStr, todayMYT } from "@/lib/commission"

// POST: upsert one person's daily numbers. Body: { userId?, date, leadsCount, appointmentsCount }
// Anyone can enter their own; managers can enter/edit for people under them; SUPER_ADMIN for anyone.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })

  const body = await req.json().catch(() => ({}))
  const userId: string = body.userId || session.user.id
  const date = body.date
  if (!isDateStr(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 })
  if (date > todayMYT()) return NextResponse.json({ error: "Can't enter numbers for a future date." }, { status: 400 })

  const leadsCount = Number(body.leadsCount)
  const appointmentsCount = Number(body.appointmentsCount)
  for (const [n, label] of [[leadsCount, "Leads"], [appointmentsCount, "Appointments"]] as const) {
    if (!Number.isInteger(n) || n < 0 || n > 10000) {
      return NextResponse.json({ error: `${label} must be a whole number of 0 or more.` }, { status: 400 })
    }
  }

  if (!(await canManageUser(session.user.id, session.user.role, userId))) {
    return NextResponse.json({ error: "You can't edit entries for this person." }, { status: 403 })
  }

  const row = await db.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, leadsCount, appointmentsCount, updatedById: session.user.id },
    update: { leadsCount, appointmentsCount, updatedById: session.user.id },
  })
  return NextResponse.json(row)
}
