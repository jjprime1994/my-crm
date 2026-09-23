import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // age distribution of unclaimed NEW selangor leads
  const age = await pool.query(`
    SELECT DATE("createdAt") d, COUNT(*) FROM "Lead"
    WHERE "assignedToId" IS NULL AND branch = 'Selangor' AND status = 'NEW'
    GROUP BY d ORDER BY d ASC
  `)
  console.log("Unclaimed Selangor NEW leads by creation date (oldest first):")
  age.rows.forEach((r: any) => console.log("  ", r.d, r.count))

  const oldest = await pool.query(`
    SELECT MIN("createdAt") oldest, MAX("createdAt") newest FROM "Lead"
    WHERE "assignedToId" IS NULL AND branch = 'Selangor' AND status = 'NEW'
  `)
  console.log("Oldest/newest:", oldest.rows[0])

  // who can see Selangor - StateRoute
  const routes = await pool.query(`SELECT id, states, "userIds" FROM "StateRoute"`).catch(() => null)
  if (routes) {
    console.log("StateRoutes:")
    routes.rows.forEach((r: any) => console.log("  ", r.id, r.states, r.userIds))
  }

  // claim rate last 14 days for selangor
  const claims = await pool.query(`
    SELECT DATE("claimedAt") d, COUNT(*) FROM "Lead"
    WHERE branch = 'Selangor' AND "claimedAt" IS NOT NULL AND "claimedAt" >= NOW() - INTERVAL '14 days'
    GROUP BY d ORDER BY d ASC
  `)
  console.log("Selangor claims last 14 days:")
  claims.rows.forEach((r: any) => console.log("  ", r.d, r.count))

  // inflow rate last 14 days for selangor (any assignment status)
  const inflow = await pool.query(`
    SELECT DATE("createdAt") d, COUNT(*) FROM "Lead"
    WHERE branch = 'Selangor' AND "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY d ORDER BY d ASC
  `)
  console.log("Selangor new leads (inflow) last 14 days:")
  inflow.rows.forEach((r: any) => console.log("  ", r.d, r.count))

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
