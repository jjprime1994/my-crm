-- Make LeadNote.authorId nullable so deleting a user doesn't cascade-block
ALTER TABLE "LeadNote" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "LeadNote" DROP CONSTRAINT IF EXISTS "LeadNote_authorId_fkey";
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make LeadAssignmentLog.assignedById nullable so deleting the assigner preserves logs
ALTER TABLE "LeadAssignmentLog" ALTER COLUMN "assignedById" DROP NOT NULL;
ALTER TABLE "LeadAssignmentLog" DROP CONSTRAINT IF EXISTS "LeadAssignmentLog_assignedById_fkey";
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make LeadAssignmentLog.assignedToId SetNull on delete (was missing onDelete)
ALTER TABLE "LeadAssignmentLog" DROP CONSTRAINT IF EXISTS "LeadAssignmentLog_assignedToId_fkey";
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
