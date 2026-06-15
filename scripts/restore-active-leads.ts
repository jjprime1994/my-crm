import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const dryRun = process.argv[2] !== "--apply"
  if (dryRun) console.log("DRY RUN — pass --apply to execute\n")

  // Find unassigned leads that are not NEW (actively worked)
  // and trace back who last changed their status via LeadStatusHistory
  const res = await pool.query(`
    SELECT DISTINCT ON (l.id)
      l.id,
      l."firstName",
      l."lastName",
      l.branch,
      l.status,
      l."campaignName",
      h."changedById",
      u.name AS worked_by,
      mgr."coveredStates",
      mgr.name AS manager
    FROM "Lead" l
    JOIN "LeadStatusHistory" h ON h."leadId" = l.id
    JOIN "User" u ON u.id = h."changedById"
    LEFT JOIN "User" mgr ON mgr.id = u."managerId"
    WHERE l."assignedToId" IS NULL
      AND l."claimedAt" IS NULL
      AND l.status NOT IN ('NEW', 'CLOSED_WON', 'CLOSED_LOST')
    ORDER BY l.id, h."createdAt" DESC
  `)

  console.log(`Found ${res.rows.length} actively-worked leads to restore:\n`)
  res.rows.forEach((r: any) =>
    console.log(`  ${r.id} | ${r.firstName} ${r.lastName} | ${r.status} | branch=${r.branch} | worked by: ${r.worked_by} (${r.manager}, covers: ${r.coveredStates?.join(", ") || "any"})`)
  )

  if (!dryRun && res.rows.length > 0) {
    for (const row of res.rows) {
      await pool.query(
        `UPDATE "Lead" SET "assignedToId" = $1 WHERE id = $2`,
        [row.changedById, row.id]
      )
    }
    console.log(`\nRestored ${res.rows.length} leads.`)
  }
}

main().catch(console.error).finally(() => pool.end())
