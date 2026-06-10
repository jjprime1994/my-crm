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

function resolveBranchFromLead(lead: { adName: string | null; campaignName: string | null; rawData: unknown }): string | null {
  const fieldData = (lead.rawData as any)?.field_data as { name: string; values: string[] }[] | undefined
  const get = (key: string) => fieldData?.find((f) => f.name === key)?.values?.[0]

  const knownKeys = ["state", "location", "city", "where_are_you_from", "negeri", "kawasan", "which_state_are_you_located_in?", "which_state_are_you_located_in"]
  for (const key of knownKeys) {
    const branch = resolveStateBranch(get(key))
    if (branch) return branch
  }

  // Scan all field values
  if (fieldData) {
    for (const field of fieldData) {
      const branch = resolveStateBranch(field.values?.[0])
      if (branch) return branch
    }
  }

  if (lead.campaignName) {
    const branch = resolveStateBranch(lead.campaignName)
    if (branch) return branch
  }
  if (lead.adName) {
    const branch = resolveStateBranch(lead.adName)
    if (branch) return branch
  }

  return null
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

  // Resolve all states in memory first, then fire all updates in parallel
  const toUpdate = leads
    .map((lead) => ({ id: lead.id, branch: resolveBranchFromLead(lead) }))
    .filter((l): l is { id: string; branch: string } => l.branch !== null)

  await Promise.all(toUpdate.map((l) => db.lead.update({ where: { id: l.id }, data: { branch: l.branch } })))

  return NextResponse.json({ total: leads.length, updated: toUpdate.length })
}
