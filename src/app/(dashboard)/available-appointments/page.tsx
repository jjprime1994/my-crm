import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import AvailableAppointmentsClient from "@/components/AvailableAppointmentsClient"
import { getAvailableAppointments } from "@/lib/available-appointments"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"

export default async function AvailableAppointmentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [effectiveRole, viewAsUser] = await Promise.all([
    getViewAsRole(session.user.role),
    getViewAsUser(session.user.role),
  ])
  const effectiveUserId = viewAsUser?.id ?? session.user.id

  const MYT_OFFSET = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowInMYT = nowMs + MYT_OFFSET
  const startOfDayInMYT = nowInMYT - (nowInMYT % (24 * 60 * 60 * 1000))
  const startOfDayUTC = new Date(startOfDayInMYT - MYT_OFFSET)
  const nextMidnightUTC = new Date(startOfDayInMYT + 24 * 60 * 60 * 1000 - MYT_OFFSET)

  const [slots, user, recentClaims] = await Promise.all([
    getAvailableAppointments(effectiveUserId, effectiveRole),
    db.user.findUnique({ where: { id: effectiveUserId }, select: { appointmentClaimLimit: true } }),
    db.appointmentSlot.count({ where: { claimedById: effectiveUserId, claimedAt: { gte: startOfDayUTC } } }),
  ])

  const isSuperAdmin = effectiveRole === "SUPER_ADMIN"

  return (
    <AvailableAppointmentsClient
      slots={slots}
      appointmentClaimLimit={user?.appointmentClaimLimit ?? 5}
      recentClaims={recentClaims}
      resetAt={nextMidnightUTC.toISOString()}
      isUnlimited={isSuperAdmin}
    />
  )
}
