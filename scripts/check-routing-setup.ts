import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Users with coveredStates set
  const coveredRes = await pool.query(`
    SELECT name, role, "coveredStates", "managerId"
    FROM "User"
    WHERE array_length("coveredStates", 1) > 0
    ORDER BY name
  `)
  console.log(`\n=== Users with coveredStates (${coveredRes.rows.length}) ===`)
  coveredRes.rows.forEach((u: any) => console.log(`  ${u.name.padEnd(30)} ${u.role.padEnd(15)} states: ${u.coveredStates.join(", ")}`))

  // All StateRoutes
  const stateRes = await pool.query(`
    SELECT state, "userIds", "lastAssignedIndex" FROM "StateRoute" ORDER BY state
  `)
  console.log(`\n=== StateRoutes (${stateRes.rows.length}) ===`)
  for (const r of stateRes.rows) {
    const users = r.userIds.length > 0
      ? await pool.query(`SELECT name FROM "User" WHERE id = ANY($1)`, [r.userIds])
      : { rows: [] }
    console.log(`  ${r.state.padEnd(25)} → ${users.rows.map((u: any) => u.name).join(", ") || "(empty)"}`)
  }

  // Choo Yun Wah details
  const chooRes = await pool.query(`
    SELECT id, name, "coveredStates", "managerId", "isDefaultTeam"
    FROM "User" WHERE email = 'yunwahnuvending@gmail.com'
  `)
  const choo = chooRes.rows[0]
  console.log(`\n=== Choo Yun Wah ===`)
  console.log(`  coveredStates: ${choo.coveredStates.length ? choo.coveredStates.join(", ") : "(none)"}`)
  console.log(`  isDefaultTeam: ${choo.isDefaultTeam}`)
}

main().finally(() => pool.end())
