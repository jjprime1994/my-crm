import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Get Choo Yun Wah's user ID
  const userRes = await pool.query(`SELECT id, name FROM "User" WHERE email = 'yunwahnuvending@gmail.com'`)
  const user = userRes.rows[0]
  console.log(`\nUser: ${user?.name} (id: ${user?.id})\n`)

  // StateRoutes
  const stateRes = await pool.query(`SELECT state, "userIds", "lastAssignedIndex" FROM "StateRoute" ORDER BY state`)
  console.log("=== StateRoute ===")
  for (const r of stateRes.rows) {
    const hasUser = user && r.userIds.includes(user.id)
    console.log(`  ${r.state.padEnd(25)} users: ${r.userIds.length}  idx: ${r.lastAssignedIndex}${hasUser ? "  *** CHOO YUN WAH IS HERE ***" : ""}`)
  }

  // AdRoutes
  const adRes = await pool.query(`SELECT "adName", "teamIds", archived FROM "AdRoute" ORDER BY "adName"`)
  console.log("\n=== AdRoute ===")
  for (const r of adRes.rows) {
    const hasUser = user && r.teamIds.includes(user.id)
    console.log(`  [${r.archived ? "archived" : "active  "}] ${r.adName.padEnd(40)} teams: ${r.teamIds.length}${hasUser ? "  *** CHOO YUN WAH IS HERE ***" : ""}`)
  }
}

main().finally(() => pool.end())
