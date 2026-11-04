-- CreateEnum
CREATE TYPE "CommissionKind" AS ENUM ('MA', 'LA');

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "leadsCount" INTEGER NOT NULL DEFAULT 0,
    "appointmentsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionClaim" (
    "id" TEXT NOT NULL,
    "kind" "CommissionKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "branch" TEXT,
    "customerName" TEXT NOT NULL,
    "commissionType" TEXT,
    "packageType" TEXT,
    "machineType" TEXT,
    "poNo" TEXT,
    "poDate" TEXT,
    "sellingPrice" DECIMAL(12,2),
    "totalCollection" DECIMAL(12,2),
    "lastPaymentDate" TEXT,
    "machineCount" INTEGER,
    "kpi" DECIMAL(12,2),
    "incentive" DECIMAL(12,2),
    "machinePoNo" TEXT,
    "locationPoNo" TEXT,
    "locationName" TEXT,
    "paymentMadePct" DECIMAL(6,2),
    "amountClaim" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyActivity_date_idx" ON "DailyActivity"("date");
CREATE UNIQUE INDEX "DailyActivity_userId_date_key" ON "DailyActivity"("userId", "date");
CREATE INDEX "CommissionClaim_kind_month_idx" ON "CommissionClaim"("kind", "month");
CREATE INDEX "CommissionClaim_userId_month_idx" ON "CommissionClaim"("userId", "month");

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionClaim" ADD CONSTRAINT "CommissionClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Claiming starts paused (commission mode). Flip to 'false' at /superadmin/claim-system to restore.
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('claimingPaused', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
