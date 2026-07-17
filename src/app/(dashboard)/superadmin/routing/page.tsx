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

  const [ads, routes, managers, defaultTeam, stateRoutes, allUsers] = await Promise.all([
    db.lead.findMany({
      where: { adName: { not: null } },
      select: { adId: true, adName: true },
      distinct: ["adName"],
      orderBy: { adName: "asc" },
    }),
    db.adRoute.findMany().catch(() => []),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, coveredStates: true, isDefaultTeam: true, teamName: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
    db.user.findFirst({ where: { isDefaultTeam: true }, select: { id: true } }).catch(() => null),
    db.stateRoute.findMany({ select: { state: true, userIds: true } }).catch(() => []),
    db.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ])

  const routeMap = Object.fromEntries(routes.map((r) => [r.adName, r]))

  // Merge leads-based ads with manually added routes; include archived flag
  const allAdNames = new Set([
    ...ads.map((a) => a.adName!),
    ...routes.map((r) => r.adName),
  ])
  const adList = Array.from(allAdNames).sort().map((adName) => {
    const lead = ads.find((a) => a.adName === adName)
    const route = routeMap[adName]
    return {
      adId: route?.adId ?? lead?.adId ?? null,
      adName,
      teamIds: route?.teamIds ?? [],
      userIds: route?.userIds ?? [],
      userStates: (route?.userStates as Record<string, string[]>) ?? {},
      archived: route?.archived ?? false,
    }
  })

  const stateRouteMap = Object.fromEntries(stateRoutes.map((r) => [r.state, r.userIds]))

  return (
    <AdRoutingClient
      ads={adList}
      managers={managers}
      defaultTeamId={defaultTeam?.id ?? null}
      stateRouteMap={stateRouteMap}
      allUsers={allUsers}
    />
  )
}
