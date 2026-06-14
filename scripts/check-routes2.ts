import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const userRes = await pool.query(`SELECT id, name, "managerId" FROM "User" WHERE email = 'yunwahnuvending@gmail.com'`)
  const user = userRes.rows[0]
  console.log(`\nChoo Yun Wah: id=${user.id}  managerId=${user.managerId ?? "none"}\n`)

  if (user.managerId) {
    const mgrRes = await pool.query(`SELECT id, name, role FROM "User" WHERE id = $1`, [user.managerId])
    const mgr = mgrRes.rows[0]
    console.log(`Manager: ${mgr?.name} (${mgr?.role})\n`)
  }

  // Get one AdRoute and show what the teamIds actually map to
  const adRes = await pool.query(`SELECT "adName", "teamIds" FROM "AdRoute" WHERE archived = false LIMIT 1`)
  const route = adRes.rows[0]
  if (route?.teamIds?.length) {
    console.log(`=== Who is in "${route.adName}" teamIds? ===`)
    const members = await pool.query(`SELECT id, name, role, "managerId" FROM "User" WHERE id = ANY($1)`, [route.teamIds])
    members.rows.forEach((u: any) => console.log(`  ${u.name.padEnd(30)} ${u.role.padEnd(15)} managerId: ${u.managerId ?? "none"}`))
  }

  // Show all AdRoutes and whether Choo's manager is in teamIds
  console.log("\n=== AdRoutes — is Choo's manager in teamIds? ===")
  const allRoutes = await pool.query(`SELECT "adName", "teamIds", archived FROM "AdRoute" ORDER BY "adName"`)
  for (const r of allRoutes.rows) {
    const managerInTeam = user.managerId && r.teamIds.includes(user.managerId)
    const userInTeam = r.teamIds.includes(user.id)
    console.log(`  [${r.archived ? "arch" : "live"}] ${r.adName.padEnd(42)} managerInTeam:${String(!!managerInTeam).padEnd(6)} userInTeam:${userInTeam}`)
  }
}

main().finally(() => pool.end())
