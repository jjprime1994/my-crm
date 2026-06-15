import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"

type FieldEntry = { name: string; values: string[] }

function getField(fields: FieldEntry[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = fields.find((f) => f.name === key)?.values?.[0]
    if (val) return val
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (key !== process.env.BACKFILL_SECRET || !key) {
    const session = await auth()
    if (!session || !isSuperAdmin(session.user.role))
      return new NextResponse("Forbidden", { status: 403 })
  }

  const leads = await db.lead.findMany({
    where: {
      OR: [{ phone: null }, { email: null }, { firstName: null }],
    },
    select: { id: true, phone: true, email: true, firstName: true, lastName: true, rawData: true },
  })

  let updated = 0
  let skipped = 0

  for (const lead of leads) {
    const raw = lead.rawData as Record<string, unknown> | null
    const fields: FieldEntry[] = Array.isArray(raw?.field_data) ? (raw!.field_data as FieldEntry[]) : []

    if (fields.length === 0) { skipped++; continue }

    const phone = lead.phone ?? getField(fields,
      "phone_number", "phone", "whatsapp_number", "whatsapp",
      "mobile_phone", "mobile", "contact_number", "hp", "handphone",
      "no_telefon", "telefon"
    )
    const email = lead.email ?? getField(fields, "email")

    let firstName: string | null = lead.firstName ?? null
    let lastName: string | null = lead.lastName ?? null
    if (!firstName) {
      const fullName = getField(fields, "full_name", "name", "nama", "nama_penuh")
      if (fullName) {
        const parts = fullName.trim().split(" ")
        firstName = parts[0]
        lastName = parts.slice(1).join(" ") || null
      } else {
        firstName = getField(fields, "first_name") ?? null
        lastName = getField(fields, "last_name") ?? null
      }
    }

    const updates: Record<string, string | null> = {}
    if (phone && !lead.phone) updates.phone = phone
    if (email && !lead.email) updates.email = email
    if (firstName && !lead.firstName) updates.firstName = firstName
    if (lastName && !lead.lastName) updates.lastName = lastName

    if (Object.keys(updates).length === 0) { skipped++; continue }

    await db.lead.update({ where: { id: lead.id }, data: updates })
    updated++
  }

  return NextResponse.json({ total: leads.length, updated, skipped })
}

export async function GET() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const total = await db.lead.count({ where: { OR: [{ phone: null }, { email: null }, { firstName: null }] } })
  const withRawFieldData = await db.lead.count({
    where: {
      OR: [{ phone: null }, { email: null }, { firstName: null }],
      rawData: { not: {} },
    },
  })

  return NextResponse.json({ leadsWithMissingContactFields: total, withRawFieldData })
}
