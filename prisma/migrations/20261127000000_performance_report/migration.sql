-- Sales & Location Report (new table only; nothing existing changes)
CREATE TYPE "ReportKind" AS ENUM ('SALES', 'LOCATION');

CREATE TABLE "PerformanceReport" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "sellingPrice" DECIMAL(12,2),
    "collection" DECIMAL(12,2),
    "packageType" TEXT,
    "locationDescription" TEXT,
    "locationType" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerformanceReport_kind_month_idx" ON "PerformanceReport"("kind", "month");
CREATE INDEX "PerformanceReport_userId_month_idx" ON "PerformanceReport"("userId", "month");

ALTER TABLE "PerformanceReport" ADD CONSTRAINT "PerformanceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
