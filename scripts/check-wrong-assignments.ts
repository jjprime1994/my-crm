import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Find leads auto-assigned to a salesperson whose manager's coveredStates
  // doesn't include the lead's branch (and manager has a non-empty coveredStates restriction)
  const res = await pool.query(`
    SELECT
      l.id,
      l."firstName",
      l."lastName",
      l.branch,
      l."campaignName",
      l.status,
      sp.name AS salesperson,
      sp.email AS sp_email,
      mgr.name AS manager,
      mgr."coveredStates"
    FROM "Lead" l
    JOIN "User" sp ON sp.id = l."assignedToId"
    JOIN "User" mgr ON mgr.id = sp."managerId"
    WHERE l."claimedAt" IS NULL
      AND l.branch IS NOT NULL
      AND array_length(mgr."coveredStates", 1) > 0
      AND NOT (l.branch = ANY(mgr."coveredStates"))
    ORDER BY sp.name, l."createdAt" DESC
  `)

  if (res.rows.length === 0) {
    console.log("No wrongly assigned leads found.")
    return
  }

  // Group by salesperson
  const grouped: Record<string, typeof res.rows> = {}
  for (const row of res.rows) {
    if (!grouped[row.salesperson]) grouped[row.salesperson] = []
    grouped[row.salesperson].push(row)
  }

  console.log(`Found ${res.rows.length} wrongly assigned leads across ${Object.keys(grouped).length} salesperson(s):\n`)
  for (const [name, leads] of Object.entries(grouped)) {
    const first = leads[0]
    console.log(`${name} (manager: ${first.manager}, covers: ${first.coveredStates.join(", ")}) — ${leads.length} lead(s)`)
    for (const l of leads) {
      console.log(`  ${l.id} | ${l.firstName} ${l.lastName} | branch=${l.branch} | campaign=${l.campaignName} | status=${l.status}`)
    }
    console.log()
  }
}

main().catch(console.error).finally(() => pool.end())
