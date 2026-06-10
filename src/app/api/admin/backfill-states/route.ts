import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { resolveStateBranch } from "@/lib/branch"

// GET: inspect rawData of a sample lead missing a state
export async function GET() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const samples = await db.lead.findMany({
    where: { branch: null, adName: { not: null } },
    select: { id: true, adName: true, rawData: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  })

  return NextResponse.json(samples.map((l) => ({
    id: l.id,
    adName: l.adName,
    field_data: (l.rawData as any)?.field_data ?? null,
  })))
}

export async function POST() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const leads = await db.lead.findMany({
    where: { branch: null },
    select: { id: true, adName: true, campaignName: true, rawData: true },
  })

  let updated = 0
  for (const lead of leads) {
    const fieldData = (lead.rawData as any)?.field_data as { name: string; values: string[] }[] | undefined

    // Try known field names first, then scan every field value for a recognisable state
    const knownKeys = ["state", "location", "city", "where_are_you_from", "negeri", "kawasan", "which_state_are_you_located_in"]
    const get = (key: string) => fieldData?.find((f) => f.name === key)?.values?.[0]

    let branch: string | null = null
    for (const key of knownKeys) {
      branch = resolveStateBranch(get(key))
      if (branch) break
    }

    // Fallback: scan all field values
    if (!branch && fieldData) {
      for (const field of fieldData) {
        branch = resolveStateBranch(field.values?.[0])
        if (branch) break
      }
    }

    if (!branch && lead.campaignName) branch = resolveStateBranch(lead.campaignName)
    if (!branch && lead.adName) branch = resolveStateBranch(lead.adName)

    if (branch) {
      await db.lead.update({ where: { id: lead.id }, data: { branch } })
      updated++
    }
  }

  return NextResponse.json({ total: leads.length, updated })
}
