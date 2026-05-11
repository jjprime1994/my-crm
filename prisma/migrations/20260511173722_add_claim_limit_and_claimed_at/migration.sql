-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "claimLimit" INTEGER NOT NULL DEFAULT 5;
