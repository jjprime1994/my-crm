-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appointmentClaimLimit" INTEGER NOT NULL DEFAULT 5;

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('OPEN', 'BOOKED', 'CLAIMED', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppConversationState" AS ENUM ('AWAITING_VALIDATION', 'AWAITING_BRANCH', 'AWAITING_SLOT', 'BOOKED', 'DECLINED');

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'OPEN',
    "leadId" TEXT,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "leadId" TEXT,
    "state" "WhatsAppConversationState" NOT NULL DEFAULT 'AWAITING_VALIDATION',
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSlot_leadId_key" ON "AppointmentSlot"("leadId");

-- CreateIndex
CREATE INDEX "AppointmentSlot_branch_status_idx" ON "AppointmentSlot"("branch", "status");

-- CreateIndex
CREATE INDEX "AppointmentSlot_startAt_idx" ON "AppointmentSlot"("startAt");

-- CreateIndex
CREATE INDEX "AppointmentSlot_claimedById_claimedAt_idx" ON "AppointmentSlot"("claimedById", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_phone_key" ON "WhatsAppConversation"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_leadId_key" ON "WhatsAppConversation"("leadId");

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
