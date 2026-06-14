import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Check branch values
  const branches = await pool.query(`
    SELECT branch, COUNT(*) as count FROM "Lead"
    GROUP BY branch ORDER BY count DESC LIMIT 20
  `)
  console.log("\n=== branch field values ===")
  branches.rows.forEach((r: any) => console.log(`  ${String(r.branch ?? "null").padEnd(30)} ${r.count}`))

  // Check source values
  const sources = await pool.query(`
    SELECT source, COUNT(*) as count FROM "Lead"
    GROUP BY source ORDER BY count DESC
  `)
  console.log("\n=== source field values ===")
  sources.rows.forEach((r: any) => console.log(`  ${String(r.source ?? "null").padEnd(20)} ${r.count}`))

  // Sample rawData keys from a few leads
  const sample = await pool.query(`
    SELECT id, "rawData", "adName", "campaignName", branch
    FROM "Lead"
    WHERE "rawData" IS NOT NULL
    LIMIT 3
  `)
  console.log("\n=== rawData sample keys ===")
  for (const r of sample.rows) {
    const keys = r.rawData ? Object.keys(r.rawData) : []
    console.log(`  ad: ${r.adName} | branch: ${r.branch} | rawData keys: ${keys.join(", ")}`)
    if (r.rawData) console.log("  rawData:", JSON.stringify(r.rawData).slice(0, 300))
  }
}

main().finally(() => pool.end())
