import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Find non-Johor leads auto-assigned to Choo (no claimedAt = auto-assigned, not self-claimed)
  const preview = await pool.query(`
    SELECT l.id, l."firstName", l."lastName", l.branch, l."campaignName", l.status
    FROM "Lead" l
    JOIN "User" u ON u.id = l."assignedToId"
    WHERE u.email = 'yunwahnuvending@gmail.com'
      AND (l.branch IS NULL OR l.branch != 'Johor')
      AND l."claimedAt" IS NULL
    ORDER BY l."createdAt" DESC
  `)

  if (preview.rows.length === 0) {
    console.log("No non-Johor auto-assigned leads found for Choo Yun Wah.")
    return
  }

  console.log(`Found ${preview.rows.length} leads to unassign:`)
  preview.rows.forEach((r: any) =>
    console.log(`  ${r.id} | ${r.firstName} ${r.lastName} | branch=${r.branch} | campaign=${r.campaignName} | status=${r.status}`)
  )

  const ids = preview.rows.map((r: any) => r.id)

  const result = await pool.query(`
    UPDATE "Lead"
    SET "assignedToId" = NULL
    WHERE id = ANY($1)
  `, [ids])

  console.log(`\nUnassigned ${result.rowCount} leads.`)
}

main().catch(console.error).finally(() => pool.end())
