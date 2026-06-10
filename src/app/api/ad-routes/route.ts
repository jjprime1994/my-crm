import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

// GET: all known ads (from leads) merged with their routing rules
export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

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

  const result = ads.map((ad) => ({
    adId: ad.adId,
    adName: ad.adName!,
    teamIds: routeMap[ad.adName!]?.teamIds ?? [],
    routeId: routeMap[ad.adName!]?.id ?? null,
  }))

  return NextResponse.json({ ads: result, managers, defaultTeamId: defaultTeam?.id ?? null })
}

// POST: upsert a route for an ad
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { adName, adId, teamIds } = await req.json()
  if (!adName) return new NextResponse("adName required", { status: 400 })

  const route = await db.adRoute.upsert({
    where: { adName },
    create: { id: crypto.randomUUID(), adName, adId: adId ?? null, teamIds: teamIds ?? [] },
    update: { teamIds: teamIds ?? [], adId: adId ?? undefined },
  })

  return NextResponse.json(route)
}

// DELETE: remove an ad route by adName
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { adName } = await req.json()
  if (!adName) return new NextResponse("adName required", { status: 400 })

  await db.adRoute.deleteMany({ where: { adName } })

  return new NextResponse(null, { status: 204 })
}

// PATCH: set default team (clears previous default)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { defaultTeamId } = await req.json()

  await db.user.updateMany({ where: { isDefaultTeam: true }, data: { isDefaultTeam: false } })
  if (defaultTeamId) {
    await db.user.update({ where: { id: defaultTeamId }, data: { isDefaultTeam: true } })
  }

  return new NextResponse(null, { status: 204 })
}
