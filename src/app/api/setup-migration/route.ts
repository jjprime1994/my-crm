export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-setup-key")
  if (key !== "crm-migrate-2026") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    // Create the table (idempotent)
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "LeadStatusHistory" (
        "id"          TEXT          NOT NULL,
        "leadId"      TEXT          NOT NULL,
        "from"        "LeadStatus",
        "to"          "LeadStatus"  NOT NULL,
        "changedById" TEXT,
        "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "LeadStatusHistory_leadId_fkey"
          FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "LeadStatusHistory_changedById_fkey"
          FOREIGN KEY ("changedById") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
      )
    `

    // Create index (idempotent)
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_idx"
        ON "LeadStatusHistory"("leadId")
    `

    return NextResponse.json({ ok: true, message: "LeadStatusHistory table ready" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
