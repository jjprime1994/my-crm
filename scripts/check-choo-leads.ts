import pg from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const userRes = await pool.query(
    `SELECT id, name, email, role FROM "User" WHERE LOWER(name) LIKE '%choo yun wah%' OR email = 'yunwahnuvending@gmail.com'`
  )
  if (userRes.rows.length === 0) { console.log("User not found"); return }

  const user = userRes.rows[0]
  console.log(`\nUser: ${user.name} (${user.email}) — role: ${user.role}\n`)

  const leadsRes = await pool.query(
    `SELECT id, "firstName", "lastName", "adName", "campaignName", "claimedAt", "updatedAt", status
     FROM "Lead"
     WHERE "assignedToId" = $1
     ORDER BY "claimedAt" DESC NULLS LAST`,
    [user.id]
  )

  const leads = leadsRes.rows
  console.log(`Total leads assigned: ${leads.length}\n`)

  let selfClaimed = 0, adminAssigned = 0

  for (const l of leads) {
    const how = l.claimedAt ? "SELF-CLAIMED   " : "ADMIN-ASSIGNED "
    const source = l.campaignName ?? l.adName ?? "unknown source"
    const name = `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || "—"
    const date = l.claimedAt
      ? new Date(l.claimedAt).toLocaleString("en-MY")
      : new Date(l.updatedAt).toLocaleString("en-MY") + " (no claimedAt)"

    console.log(`[${how}]  ${date.padEnd(26)}  ${name.padEnd(22)}  ${source}`)

    if (l.claimedAt) selfClaimed++; else adminAssigned++
  }

  console.log(`\nSummary:`)
  console.log(`  Self-claimed:   ${selfClaimed}`)
  console.log(`  Admin-assigned: ${adminAssigned}`)
}

main().finally(() => pool.end())
