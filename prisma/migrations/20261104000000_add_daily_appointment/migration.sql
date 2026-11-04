-- CreateTable
CREATE TABLE "DailyAppointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceOther" TEXT,
    "customerName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAppointment_userId_date_idx" ON "DailyAppointment"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyAppointment_date_idx" ON "DailyAppointment"("date");

-- AddForeignKey
ALTER TABLE "DailyAppointment" ADD CONSTRAINT "DailyAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

