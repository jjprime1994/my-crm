import { PrismaClient, Prisma } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; dbInitialized: boolean }

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Runs once per process on startup.
if (!globalForPrisma.dbInitialized) {
  globalForPrisma.dbInitialized = true

  db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "LeadStatusHistory" (
      "id"          TEXT         NOT NULL,
      "leadId"      TEXT         NOT NULL,
      "from"        "LeadStatus",
      "to"          "LeadStatus" NOT NULL,
      "changedById" TEXT,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "LeadStatusHistory_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "LeadStatusHistory_changedById_fkey"
        FOREIGN KEY ("changedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `
  .then(() =>
    db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_idx"
        ON "LeadStatusHistory"("leadId")
    `
  )
  .then(() => backfillStatusHistory())
  .catch(() => {})
}

async function backfillStatusHistory() {
  // Find leads that have no history entries yet
  const leads = await db.lead.findMany({
    where: { statusHistory: { none: {} } },
    select: { id: true, status: true, createdAt: true, updatedAt: true, assignedToId: true },
  })
  if (leads.length === 0) return

  const rows: Prisma.LeadStatusHistoryCreateManyInput[] = []

  for (const lead of leads) {
    // Every lead started as NEW
    rows.push({ leadId: lead.id, from: null, to: "NEW", createdAt: lead.createdAt, changedById: null })
    if (lead.status !== "NEW") {
      rows.push({ leadId: lead.id, from: "NEW", to: lead.status, createdAt: lead.updatedAt, changedById: lead.assignedToId })
    }
  }

  await db.leadStatusHistory.createMany({ data: rows })
}
