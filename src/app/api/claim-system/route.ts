import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/roles"
import { isClaimingPaused, setClaimingPaused } from "@/lib/app-settings"

export async function GET() {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  return NextResponse.json({ paused: await isClaimingPaused() })
}

// SUPER_ADMIN only: pause / resume the lead + appointment claim system.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  const { paused } = await req.json()
  if (typeof paused !== "boolean") return new NextResponse("paused (boolean) required", { status: 400 })
  await setClaimingPaused(paused)
  return NextResponse.json({ paused })
}
