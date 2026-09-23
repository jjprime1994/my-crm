import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import AppointmentSlotsClient from "@/components/AppointmentSlotsClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function AppointmentSlotsPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const slots = await db.appointmentSlot.findMany({
    select: {
      id: true, branch: true, startAt: true, endAt: true, status: true,
      claimedBy: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { startAt: "desc" },
  })

  return <AppointmentSlotsClient slots={slots} />
}
