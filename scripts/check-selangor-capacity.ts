import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: process.argv[2] || ".env.production.local" })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const route = await pool.query(`SELECT state, "userIds" FROM "StateRoute" WHERE state = 'Selangor'`)
  console.log("Selangor StateRoute:", route.rows)

  if (route.rows.length && route.rows[0].userIds.length) {
    const ids = route.rows[0].userIds
    const users = await pool.query(
      `SELECT name, disabled, "claimLimit" FROM "User" WHERE id = ANY($1::text[])`,
      [ids]
    )
    console.log("Selangor route members:")
    let capacity = 0
    users.rows.forEach((u: any) => {
      console.log("  ", u.name, "disabled:", u.disabled, "claimLimit:", u.claimLimit)
      if (!u.disabled) capacity += u.claimLimit
    })
    console.log("Total daily claim capacity (active members' claimLimit sum):", capacity)
  }

  // default team check
  const defaultTeam = await pool.query(`SELECT name, "isDefaultTeam", "coveredStates" FROM "User" WHERE "isDefaultTeam" = true OR 'Selangor' = ANY("coveredStates")`)
  console.log("Admins with Selangor coverage or default team:", defaultTeam.rows)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
