import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const res = await pool.query(`
    SELECT status, COUNT(*) AS count
    FROM "Lead"
    WHERE "assignedToId" IS NULL AND "claimedAt" IS NULL
    GROUP BY status
    ORDER BY count DESC
  `)
  console.log("Unassigned leads by status:")
  res.rows.forEach((r: any) => console.log(`  ${r.status}: ${r.count}`))

  const total = res.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)
  console.log(`  TOTAL: ${total}`)
}

main().catch(console.error).finally(() => pool.end())
