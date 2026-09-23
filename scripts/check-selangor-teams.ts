import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const adminIds = await pool.query(`
    SELECT id, name FROM "User"
    WHERE role IN ('ADMIN','SUPER_ADMIN') AND ('Selangor' = ANY("coveredStates") OR "isDefaultTeam" = true)
  `)
  const ids = adminIds.rows.map((r: any) => r.id)
  console.log("Selangor-covering team managers:", adminIds.rows.map((r:any)=>r.name))

  const reps = await pool.query(`
    SELECT name, disabled, "claimLimit", role FROM "User"
    WHERE "managerId" = ANY($1::text[])
    ORDER BY disabled, name
  `, [ids])
  const active = reps.rows.filter((r: any) => !r.disabled)
  const disabled = reps.rows.filter((r: any) => r.disabled)
  console.log("Active reps under Selangor-covering teams:", active.length, "| disabled:", disabled.length)
  console.log("Sum claimLimit (active reps):", active.reduce((s: number, r: any) => s + r.claimLimit, 0))
  console.log("Disabled reps under these teams:", disabled.map((r: any) => r.name))

  // company-wide inflow vs claims last 7 days for comparison
  const inflow = await pool.query(`SELECT COUNT(*) FROM "Lead" WHERE "createdAt" >= NOW() - INTERVAL '7 days'`)
  const claims = await pool.query(`SELECT COUNT(*) FROM "Lead" WHERE "claimedAt" >= NOW() - INTERVAL '7 days'`)
  console.log("Company-wide last 7 days — inflow:", inflow.rows[0].count, "claims:", claims.rows[0].count)

  const selInflow = await pool.query(`SELECT COUNT(*) FROM "Lead" WHERE branch='Selangor' AND "createdAt" >= NOW() - INTERVAL '7 days'`)
  const selClaims = await pool.query(`SELECT COUNT(*) FROM "Lead" WHERE branch='Selangor' AND "claimedAt" >= NOW() - INTERVAL '7 days'`)
  console.log("Selangor last 7 days — inflow:", selInflow.rows[0].count, "claims:", selClaims.rows[0].count)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
