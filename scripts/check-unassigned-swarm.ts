import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const totalUsers = await pool.query('SELECT COUNT(*) FROM "User"')
  const disabledUsers = await pool.query('SELECT name, email, "disabledAt" FROM "User" WHERE disabled = true ORDER BY "disabledAt" DESC')
  const totalLeads = await pool.query('SELECT COUNT(*) FROM "Lead"')
  const unassigned = await pool.query('SELECT COUNT(*) FROM "Lead" WHERE "assignedToId" IS NULL')
  const unassignedByStatus = await pool.query('SELECT status, COUNT(*) FROM "Lead" WHERE "assignedToId" IS NULL GROUP BY status')
  const recentUnassigned = await pool.query(`SELECT DATE("createdAt") d, COUNT(*) FROM "Lead" WHERE "assignedToId" IS NULL GROUP BY d ORDER BY d DESC LIMIT 20`)
  console.log("Total users:", totalUsers.rows[0].count)
  console.log("Disabled users:", disabledUsers.rows.length)
  disabledUsers.rows.forEach((r: any) => console.log("  -", r.name, r.email, r.disabledAt))
  console.log("Total leads:", totalLeads.rows[0].count)
  console.log("Unassigned leads:", unassigned.rows[0].count)
  console.log("Unassigned by status:", unassignedByStatus.rows)
  console.log("Unassigned by day (last 20 days w/ data):")
  recentUnassigned.rows.forEach((r: any) => console.log("  ", r.d, r.count))
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
