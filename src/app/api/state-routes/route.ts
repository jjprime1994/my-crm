import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const routes = await db.stateRoute.findMany({
    select: { state: true, userIds: true },
    orderBy: { state: "asc" },
  })

  return NextResponse.json(routes)
}

// POST: upsert a state → userIds mapping. Pass userIds: [] to clear.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })

  const { state, userIds } = await req.json()
  if (!state) return new NextResponse("state required", { status: 400 })

  const ids: string[] = userIds ?? []

  if (ids.length === 0) {
    await db.stateRoute.deleteMany({ where: { state } })
    return new NextResponse(null, { status: 204 })
  }

  const route = await db.stateRoute.upsert({
    where: { state },
    create: { id: crypto.randomUUID(), state, userIds: ids, lastAssignedIndex: 0 },
    update: { userIds: ids, lastAssignedIndex: 0 },
  })

  return NextResponse.json(route)
}
