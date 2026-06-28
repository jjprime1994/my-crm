import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

async function runBackfill(token: string) {
  const leads = await db.lead.findMany({
    where: { metaLeadId: { not: null } },
    select: { id: true, metaLeadId: true, rawData: true },
  })

  const toUpdate = leads.filter((l) => {
    const raw = l.rawData as Record<string, unknown> | null
    const fd = raw?.field_data
    return !fd || (Array.isArray(fd) && fd.length === 0)
  })

  let updated = 0, failed = 0, noData = 0
  const errors: string[] = []

  for (const lead of toUpdate) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${lead.metaLeadId}?fields=field_data&access_token=${token}`
      )
      const data = await res.json()
      if (data.error) { errors.push(`${lead.metaLeadId}: ${data.error.message}`); failed++; continue }
      const fieldData: { name: string; values: string[] }[] = data.field_data ?? []
      const existing = (lead.rawData as Record<string, unknown> | null) ?? {}
      await db.lead.update({ where: { id: lead.id }, data: { rawData: { ...existing, field_data: fieldData } } })
      if (fieldData.length > 0) updated++; else noData++
    } catch { failed++ }
  }

  return { totalWithMetaId: leads.length, alreadyHadFieldData: leads.length - toUpdate.length, processed: toUpdate.length, updated, noData, failed, errors: errors.slice(0, 10) }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return new NextResponse("META_PAGE_ACCESS_TOKEN not set", { status: 500 })
  const result = await runBackfill(token)
  return new NextResponse(
    `<pre style="font-family:monospace;padding:2rem">${JSON.stringify(result, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  )
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (key !== process.env.BACKFILL_SECRET) {
    const session = await auth()
    if (!session || !isSuperAdmin(session.user.role))
      return new NextResponse("Forbidden", { status: 403 })
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return new NextResponse("META_PAGE_ACCESS_TOKEN not set", { status: 500 })
  return NextResponse.json(await runBackfill(token))
}
