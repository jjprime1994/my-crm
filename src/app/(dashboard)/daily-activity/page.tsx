import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getViewAsRole, getViewAsUser } from "@/lib/viewas"
import { getScopedUsers } from "@/lib/team-scope"
import { comparePeople, isDateStr, todayMYT } from "@/lib/commission"
import DailyActivityClient from "@/components/DailyActivityClient"

export default async function DailyActivityPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const [role, viewAsUser, sp] = await Promise.all([
    getViewAsRole(session.user.role),
    getViewAsUser(session.user.role),
    searchParams,
  ])
  const me = viewAsUser?.id ?? session.user.id

  const today = todayMYT()
  const date = isDateStr(sp.date) && sp.date <= today ? sp.date : today
  const month = date.slice(0, 7)

  const users = (await getScopedUsers(me, role)).filter((u) => !u.disabled || u.id === me)
  const ids = users.map((u) => u.id)

  const [dayRows, monthRows] = await Promise.all([
    db.dailyActivity.findMany({ where: { userId: { in: ids }, date } }),
    db.dailyActivity.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, date: { gte: `${month}-01`, lte: `${month}-31` } },
      _sum: { leadsCount: true, appointmentsCount: true },
    }),
  ])

  const dayMap = new Map(dayRows.map((r) => [r.userId, r]))
  const monthMap = new Map(monthRows.map((r) => [r.userId, r._sum]))

  // Self first, then by team; manager on top inside each team
  const rows = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      role: u.role,
      teamId: u.teamId,
      team: u.teamLabel,
      leads: dayMap.get(u.id)?.leadsCount ?? null,
      appointments: dayMap.get(u.id)?.appointmentsCount ?? null,
      monthLeads: monthMap.get(u.id)?.leadsCount ?? 0,
      monthAppointments: monthMap.get(u.id)?.appointmentsCount ?? 0,
    }))
    .sort((a, b) => comparePeople({ ...a, id: a.userId }, { ...b, id: b.userId }, me))

  const showTeams = role === "SUPER_ADMIN"

  return <DailyActivityClient key={`${me}-${date}`} date={date} today={today} meId={me} rows={rows} showTeams={showTeams} />
}
