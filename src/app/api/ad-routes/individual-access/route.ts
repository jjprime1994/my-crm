import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isAdmin, isSuperAdmin } from "@/lib/roles"

// Both handlers below let a SUPER_ADMIN act on anyone, but scope a plain ADMIN
// (team manager) to only their own downline (direct + team-leader's reports) — this
// is the delegated counterpart to the superadmin-only bulk edit in /api/ad-routes.
async function assertCanManage(sessionUserId: string, isSuper: boolean, targetUserId: string) {
  if (isSuper) return { coveredStates: null as string[] | null }

  const me = await db.user.findUnique({ where: { id: sessionUserId }, select: { id: true, coveredStates: true } })
  if (!me) return null

  const downline = await db.user.findMany({
    where: { OR: [{ managerId: me.id }, { manager: { managerId: me.id } }] },
    select: { id: true },
  })
  if (!downline.some((u) => u.id === targetUserId)) return null

  return { coveredStates: me.coveredStates }
}

// POST: grant or update one person's individual access to an ad, scoped to state(s).
// Empty `states` = unrestricted (all states) — only a SUPER_ADMIN may set that; a
// plain ADMIN's states must be a subset of their own team's coveredStates (or any
// state, if their own team has no state restriction).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { adName, adId, userId, states } = await req.json()
  if (!adName || !userId) return new NextResponse("adName and userId required", { status: 400 })
  if (!Array.isArray(states)) return new NextResponse("states must be an array", { status: 400 })

  const isSuper = isSuperAdmin(session.user.role)
  const scope = await assertCanManage(session.user.id, isSuper, userId)
  if (!scope) return new NextResponse("You can only grant access to your own team", { status: 403 })

  if (!isSuper) {
    const myStates = scope.coveredStates ?? []
    // A team with no state restriction of its own may grant unrestricted access too;
    // a state-restricted team must scope every grant to a non-empty subset of its own states.
    if (myStates.length > 0) {
      if (states.length === 0) return new NextResponse("Choose at least one state to scope access to", { status: 400 })
      if (states.some((s: string) => !myStates.includes(s))) {
        return new NextResponse("You can only scope access to states your team covers", { status: 403 })
      }
    }
  }

  const existing = await db.adRoute.findUnique({ where: { adName } })
  const currentUserIds = existing?.userIds ?? []
  const currentUserStates = (existing?.userStates as Record<string, string[]> | null) ?? {}
  const newUserIds = currentUserIds.includes(userId) ? currentUserIds : [...currentUserIds, userId]
  const newUserStates = { ...currentUserStates, [userId]: states }

  const route = await db.adRoute.upsert({
    where: { adName },
    create: { id: crypto.randomUUID(), adName, adId: adId ?? null, teamIds: [], userIds: newUserIds, userStates: newUserStates, archived: false },
    update: { userIds: newUserIds, userStates: newUserStates },
  })

  return NextResponse.json(route)
}

// DELETE: revoke one person's individual access to an ad (same scoping as POST).
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { adName, userId } = await req.json()
  if (!adName || !userId) return new NextResponse("adName and userId required", { status: 400 })

  const isSuper = isSuperAdmin(session.user.role)
  const scope = await assertCanManage(session.user.id, isSuper, userId)
  if (!scope) return new NextResponse("You can only modify access for your own team", { status: 403 })

  const existing = await db.adRoute.findUnique({ where: { adName } })
  if (!existing) return new NextResponse(null, { status: 204 })

  const newUserIds = existing.userIds.filter((id) => id !== userId)
  const currentUserStates = (existing.userStates as Record<string, string[]> | null) ?? {}
  const newUserStates = Object.fromEntries(Object.entries(currentUserStates).filter(([id]) => id !== userId))

  await db.adRoute.update({ where: { adName }, data: { userIds: newUserIds, userStates: newUserStates } })

  return new NextResponse(null, { status: 204 })
}
