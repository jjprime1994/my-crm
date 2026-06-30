-- CreateIndex — phone and email for duplicate detection (full table scans on every webhook)
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex — branch for state-route filtering and state-based routing
CREATE INDEX "Lead_branch_idx" ON "Lead"("branch");

-- CreateIndex — adName for ad-route lookup
CREATE INDEX "Lead_adName_idx" ON "Lead"("adName");

-- CreateIndex — composite for follow-up notification query
CREATE INDEX "Lead_assignedToId_followUpAt_idx" ON "Lead"("assignedToId", "followUpAt");
