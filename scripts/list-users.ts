import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
pool.query('SELECT name, email, role FROM "User" ORDER BY name').then(r => {
  r.rows.forEach((u: any) => console.log(u.name, "|", u.email, "|", u.role))
  pool.end()
})
