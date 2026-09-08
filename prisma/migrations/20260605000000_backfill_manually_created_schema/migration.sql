-- This backfills migration history for schema changes that were previously applied
-- only via a raw-SQL boot chain in src/lib/db.ts (never through `prisma migrate`).
-- Every statement is IF NOT EXISTS / idempotent: on existing dev and production
-- databases, everything here already exists, so this is a no-op. On a database
-- rebuilt from migration history alone, this creates what's missing before later
-- migrations assume it exists (20260610000000 ALTERs AdRoute; 20260630000000
-- indexes Lead.branch).
--
-- Timestamped 20260605000000 (before both of those) rather than appended at the
-- end, specifically so it runs early enough on a from-scratch replay.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdRoute" (
    "id"        TEXT         NOT NULL,
    "adId"      TEXT,
    "adName"    TEXT         NOT NULL,
    "teamIds"   TEXT[]       NOT NULL DEFAULT '{}',
    "userIds"   TEXT[]       NOT NULL DEFAULT '{}',
    "userStates" JSONB       NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdRoute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdRoute_adName_key" UNIQUE ("adName")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StateRoute" (
    "id"                TEXT         NOT NULL,
    "state"             TEXT         NOT NULL,
    "userIds"           TEXT[]       NOT NULL DEFAULT '{}',
    "lastAssignedIndex" INT          NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StateRoute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StateRoute_state_key" UNIQUE ("state")
);

-- CreateTable
-- LeadAssignmentLog has no trace in db.ts's raw-SQL chain either — it was
-- evidently created directly against the database (e.g. via `prisma db push`)
-- at some point, with no record anywhere in this codebase of how.
CREATE TABLE IF NOT EXISTS "LeadAssignmentLog" (
    "id"           TEXT         NOT NULL,
    "leadId"       TEXT         NOT NULL,
    "assignedToId" TEXT,
    "assignedById" TEXT,
    "source"       TEXT         NOT NULL DEFAULT 'ADMIN',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadAssignmentLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadAssignmentLog_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadAssignmentLog_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadAssignmentLog_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadAssignmentLog_leadId_idx" ON "LeadAssignmentLog"("leadId");
CREATE INDEX IF NOT EXISTS "LeadAssignmentLog_assignedToId_idx" ON "LeadAssignmentLog"("assignedToId");
CREATE INDEX IF NOT EXISTS "LeadAssignmentLog_assignedById_idx" ON "LeadAssignmentLog"("assignedById");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Suggestion" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "type"        TEXT         NOT NULL DEFAULT 'SUGGESTION',
    "title"       TEXT         NOT NULL,
    "description" TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'OPEN',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Suggestion_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "branch" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'META';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "firstContactedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coveredStates" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDefaultTeam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
