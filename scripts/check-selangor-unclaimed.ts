import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const total = await pool.query(`
    SELECT COUNT(*) FROM "Lead"
    WHERE "assignedToId" IS NULL AND branch = 'Selangor'
  `)
  const byStatus = await pool.query(`
    SELECT status, COUNT(*) FROM "Lead"
    WHERE "assignedToId" IS NULL AND branch = 'Selangor'
    GROUP BY status ORDER BY count(*) DESC
  `)
  console.log("Unclaimed Selangor leads (total):", total.rows[0].count)
  console.log("By status:", byStatus.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
