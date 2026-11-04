import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isUserDisabled } from "@/lib/session-guard"
import { canManageUser } from "@/lib/team-scope"
import { syncAppointmentCount } from "@/lib/daily-appointments"

// DELETE: remove one appointment entry (owner, their managers, or SUPER_ADMIN).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (await isUserDisabled(session.user.id)) return new NextResponse("Account disabled", { status: 403 })
  const { id } = await params

  const appt = await db.dailyAppointment.findUnique({ where: { id } })
  if (!appt) return NextResponse.json({ error: "Appointment not found." }, { status: 404 })
  if (!(await canManageUser(session.user.id, session.user.role, appt.userId))) {
    return NextResponse.json({ error: "You can't edit entries for this person." }, { status: 403 })
  }

  const appointmentsCount = await db.$transaction(async (tx) => {
    await tx.dailyAppointment.delete({ where: { id } })
    return syncAppointmentCount(tx, appt.userId, appt.date, session.user.id)
  })
  return NextResponse.json({ appointmentsCount })
}
