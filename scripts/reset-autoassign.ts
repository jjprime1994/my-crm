import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Set everyone to false
  const resetAll = await pool.query(`UPDATE "User" SET "autoAssign" = false`)
  console.log(`Reset autoAssign=false for ${resetAll.rowCount} users.`)

  // Collect all userIds from all StateRoutes
  const routes = await pool.query(`SELECT state, "userIds" FROM "StateRoute"`)
  const allUserIds: string[] = []
  for (const r of routes.rows) {
    allUserIds.push(...r.userIds)
  }
  const uniqueIds = [...new Set(allUserIds)]

  if (uniqueIds.length === 0) {
    console.log("No StateRoute members found — nobody will receive auto-assigned leads.")
    return
  }

  // Set StateRoute members to true
  const enableRes = await pool.query(
    `UPDATE "User" SET "autoAssign" = true WHERE id = ANY($1) RETURNING name, email`,
    [uniqueIds]
  )
  console.log(`\nEnabled autoAssign=true for ${enableRes.rowCount} StateRoute member(s):`)
  enableRes.rows.forEach((r: any) => console.log(`  ${r.name} (${r.email})`))

  // Show which routes they're in
  console.log("\nStateRoute assignments:")
  for (const r of routes.rows) {
    if (r.userIds.length === 0) continue
    const users = await pool.query(`SELECT name FROM "User" WHERE id = ANY($1)`, [r.userIds])
    console.log(`  ${r.state} → ${users.rows.map((u: any) => u.name).join(", ")}`)
  }

  // Unassign any auto-assigned leads belonging to people who are now autoAssign=false
  const unassigned = await pool.query(`
    UPDATE "Lead"
    SET "assignedToId" = NULL
    FROM "User"
    WHERE "Lead"."assignedToId" = "User".id
      AND "User"."autoAssign" = false
      AND "Lead"."claimedAt" IS NULL
  `)
  console.log(`\nUnassigned ${unassigned.rowCount} leads that were auto-assigned to non-StateRoute members.`)
}

main().catch(console.error).finally(() => pool.end())
