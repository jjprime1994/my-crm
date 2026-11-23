-- Auto "Sales Overriding" copies for the claimant's direct leader (amount left blank until keyed in)
ALTER TABLE "CommissionClaim" ALTER COLUMN "amountClaim" DROP NOT NULL;
ALTER TABLE "CommissionClaim" ADD COLUMN "sourceClaimId" TEXT;
CREATE UNIQUE INDEX "CommissionClaim_sourceClaimId_key" ON "CommissionClaim"("sourceClaimId");
ALTER TABLE "CommissionClaim" ADD CONSTRAINT "CommissionClaim_sourceClaimId_fkey" FOREIGN KEY ("sourceClaimId") REFERENCES "CommissionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
