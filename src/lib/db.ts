import { PrismaClient, Prisma } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; dbInitialized: boolean }

function createClient() {
  const connectionString = (process.env.DATABASE_URL ?? "")
    .replace(/sslmode=require/, "sslmode=verify-full")
    .replace(/sslmode=prefer/, "sslmode=verify-full")
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Runs once per process on startup.
if (!globalForPrisma.dbInitialized) {
  globalForPrisma.dbInitialized = true

  // Table/column creation for schema that predates this app's migration history now lives in
  // prisma/migrations/20260605000000_backfill_manually_created_schema instead of here.
  // LeadStatusHistory's CREATE TABLE is likewise now redundant with migration
  // 20260514095000_add_lead_status_history, but its backfill (below) still needs to run.
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
  .then(() =>
    // Backfill: anyone already disabled before this column existed gets a fresh 30-day
    // grace period starting now, rather than vanishing from reporting immediately or
    // lingering forever with an unknown disable date.
    db.$executeRaw`UPDATE "User" SET "disabledAt" = NOW() WHERE "disabled" = true AND "disabledAt" IS NULL`
  )
  .catch(() => {})

// Backfill firstContactedAt for existing CONTACTED leads — independent so it survives chain failures.
db.$executeRaw`
  UPDATE "Lead" l
  SET "firstContactedAt" = COALESCE(
    (
      SELECT h."createdAt"
      FROM "LeadStatusHistory" h
      WHERE h."leadId" = l.id AND h."to"::text = 'CONTACTED'
      ORDER BY h."createdAt" ASC
      LIMIT 1
    ),
    l."updatedAt"
  )
  WHERE l."firstContactedAt" IS NULL
    AND l."status"::text IN ('CONTACTED', 'QUALIFIED', 'PROPOSAL', 'CLOSED_WON', 'CLOSED_LOST')
    AND l."claimedAt" IS NOT NULL
`.catch(() => {})
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
