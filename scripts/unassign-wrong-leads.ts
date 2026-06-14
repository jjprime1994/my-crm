import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const result = await pool.query(`
    UPDATE "Lead" l
    SET "assignedToId" = NULL
    FROM "User" sp
    JOIN "User" mgr ON mgr.id = sp."managerId"
    WHERE l."assignedToId" = sp.id
      AND l."claimedAt" IS NULL
      AND l.branch IS NOT NULL
      AND array_length(mgr."coveredStates", 1) > 0
      AND NOT (l.branch = ANY(mgr."coveredStates"))
  `)
  console.log(`Unassigned ${result.rowCount} leads.`)
}

main().catch(console.error).finally(() => pool.end())
