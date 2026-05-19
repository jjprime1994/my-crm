import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import AdRoutingClient from "@/components/AdRoutingClient"
import { getViewAsRole } from "@/lib/viewas"

export default async function RoutingPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)
  if (!isSuperAdmin(role)) redirect("/")

  const [ads, routes, managers, defaultTeam] = await Promise.all([
    db.lead.findMany({
      where: { adName: { not: null } },
      select: { adId: true, adName: true },
      distinct: ["adName"],
      orderBy: { adName: "asc" },
    }),
    db.adRoute.findMany().catch(() => []),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, coveredStates: true, isDefaultTeam: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
    db.user.findFirst({ where: { isDefaultTeam: true }, select: { id: true } }).catch(() => null),
  ])

  const routeMap = Object.fromEntries(routes.map((r) => [r.adName, r]))
  const adList = ads.map((ad) => ({
    adId: ad.adId ?? null,
    adName: ad.adName!,
    teamIds: routeMap[ad.adName!]?.teamIds ?? [],
  }))

  return (
    <AdRoutingClient
      ads={adList}
      managers={managers}
      defaultTeamId={defaultTeam?.id ?? null}
    />
  )
}
