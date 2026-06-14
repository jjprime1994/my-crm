import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
pool.query('SELECT COUNT(*) as count FROM "LeadAssignmentLog"').then(r => {
  console.log("LeadAssignmentLog rows:", r.rows[0].count)
  pool.end()
})
