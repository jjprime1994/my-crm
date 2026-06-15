import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Add autoAssign column if not exists
  await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "autoAssign" BOOLEAN NOT NULL DEFAULT true`)
  console.log("Column autoAssign added (or already existed).")

  // Set Marcus to autoAssign = false
  const updated = await pool.query(
    `UPDATE "User" SET "autoAssign" = false WHERE email = $1 RETURNING name, email`,
    ["marcus.nuvending@gmail.com"]
  )
  console.log("Set autoAssign=false for:", updated.rows.map((r: any) => r.name))

  // Unassign his auto-assigned leads (not self-claimed)
  const unassigned = await pool.query(`
    UPDATE "Lead"
    SET "assignedToId" = NULL
    FROM "User"
    WHERE "Lead"."assignedToId" = "User".id
      AND "User".email = $1
      AND "Lead"."claimedAt" IS NULL
  `, ["marcus.nuvending@gmail.com"])
  console.log(`Unassigned ${unassigned.rowCount} leads from Marcus.`)
}

main().catch(console.error).finally(() => pool.end())
