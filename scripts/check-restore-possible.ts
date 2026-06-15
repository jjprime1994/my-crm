import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const logCount = await pool.query(`SELECT COUNT(*) AS c FROM "LeadAssignmentLog"`)
  console.log(`Total assignment log entries: ${logCount.rows[0].c}`)

  // Unassigned leads (not self-claimed) that have a log entry — meaning we know who had them
  const restorable = await pool.query(`
    SELECT DISTINCT ON (l.id)
      l.id,
      l."firstName",
      l."lastName",
      l.branch,
      l."campaignName",
      al."assignedToId",
      u.name AS salesperson,
      mgr."coveredStates" AS mgr_covered,
      mgr.name AS manager,
      CASE
        WHEN l.branch IS NULL THEN 'no-state'
        WHEN array_length(mgr."coveredStates", 1) IS NULL OR array_length(mgr."coveredStates", 1) = 0 THEN 'mgr-no-restriction'
        WHEN l.branch = ANY(mgr."coveredStates") THEN 'correct'
        ELSE 'wrong-state'
      END AS verdict
    FROM "Lead" l
    JOIN "LeadAssignmentLog" al ON al."leadId" = l.id
    JOIN "User" u ON u.id = al."assignedToId"
    JOIN "User" mgr ON mgr.id = u."managerId"
    WHERE l."assignedToId" IS NULL
      AND l."claimedAt" IS NULL
      AND al."assignedToId" IS NOT NULL
    ORDER BY l.id, al."createdAt" DESC
  `)

  const correct = restorable.rows.filter((r: any) => r.verdict === 'correct' || r.verdict === 'mgr-no-restriction' || r.verdict === 'no-state')
  const wrong = restorable.rows.filter((r: any) => r.verdict === 'wrong-state')
  const noLog = await pool.query(`
    SELECT COUNT(*) AS c FROM "Lead" l
    WHERE l."assignedToId" IS NULL
      AND l."claimedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "LeadAssignmentLog" al WHERE al."leadId" = l.id)
  `)

  console.log(`\nRestorable via log: ${restorable.rows.length}`)
  console.log(`  Correctly assigned (can restore): ${correct.length}`)
  console.log(`  Wrong state (keep unassigned): ${wrong.length}`)
  console.log(`No log entry (cannot restore): ${noLog.rows[0].c}`)
}

main().catch(console.error).finally(() => pool.end())
