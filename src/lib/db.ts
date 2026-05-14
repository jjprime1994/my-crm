import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; dbInitialized: boolean }

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Create any tables that migrations haven't applied yet.
// Runs once per process; safe to call concurrently (IF NOT EXISTS).
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
  `.then(() =>
    db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_idx"
        ON "LeadStatusHistory"("leadId")
    `
  ).catch(() => {})
}
