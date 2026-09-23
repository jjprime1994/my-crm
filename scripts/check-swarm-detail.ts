import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const bySource = await pool.query(`
    SELECT source, COUNT(*) FROM "Lead"
    WHERE "assignedToId" IS NULL AND "createdAt" >= '2026-09-01' AND "createdAt" < '2026-09-05'
    GROUP BY source ORDER BY count(*) DESC
  `)
  console.log("Sep 1-4 unassigned leads by source:", bySource.rows)

  const byBranch = await pool.query(`
    SELECT branch, COUNT(*) FROM "Lead"
    WHERE "assignedToId" IS NULL AND "createdAt" >= '2026-09-01' AND "createdAt" < '2026-09-05'
    GROUP BY branch ORDER BY count(*) DESC
  `)
  console.log("Sep 1-4 unassigned leads by branch:", byBranch.rows)

  const disabledActive = await pool.query(`
    SELECT u.name, u.email, COUNT(l.id) as active_leads
    FROM "User" u JOIN "Lead" l ON l."assignedToId" = u.id
    WHERE u.disabled = true AND l.status NOT IN ('CLOSED_WON','CLOSED_LOST')
    GROUP BY u.id, u.name, u.email
    ORDER BY active_leads DESC
  `)
  console.log("Disabled users still holding active leads:", disabledActive.rows)

  const totalActive = await pool.query(`SELECT COUNT(*) FROM "Lead" WHERE status NOT IN ('CLOSED_WON','CLOSED_LOST')`)
  console.log("Total active (non-closed) leads:", totalActive.rows[0].count)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
