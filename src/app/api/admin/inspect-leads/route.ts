import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const leads = await db.lead.findMany({
    select: { id: true, firstName: true, lastName: true, metaLeadId: true, rawData: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const summary = {
    total: await db.lead.count(),
    withMetaLeadId: await db.lead.count({ where: { metaLeadId: { not: null } } }),
    withFieldData: 0,
    withoutFieldData: 0,
    noMetaLeadId: 0,
  }

  const allLeads = await db.lead.findMany({
    select: { metaLeadId: true, rawData: true },
  })

  for (const l of allLeads) {
    if (!l.metaLeadId) { summary.noMetaLeadId++; continue }
    const raw = l.rawData as Record<string, unknown> | null
    if (raw?.field_data && Array.isArray(raw.field_data) && (raw.field_data as unknown[]).length > 0)
      summary.withFieldData++
    else
      summary.withoutFieldData++
  }

  const recent = leads.map((l) => {
    const raw = l.rawData as Record<string, unknown> | null
    const fieldData = raw?.field_data as unknown[] | undefined
    return {
      name: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim(),
      metaLeadId: l.metaLeadId ?? null,
      hasRawData: raw !== null,
      fieldDataCount: Array.isArray(fieldData) ? fieldData.length : null,
    }
  })

  return new NextResponse(
    `<pre style="font-family:monospace;padding:2rem;font-size:13px">${JSON.stringify({ summary, recent20: recent }, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  )
}
