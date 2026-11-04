import { db } from "@/lib/db"

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

// Keep DailyActivity.appointmentsCount equal to the number of DailyAppointment rows for that day.
export async function syncAppointmentCount(tx: Tx, userId: string, date: string, actorId: string): Promise<number> {
  const n = await tx.dailyAppointment.count({ where: { userId, date } })
  await tx.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, appointmentsCount: n, updatedById: actorId },
    update: { appointmentsCount: n, updatedById: actorId },
  })
  return n
}
