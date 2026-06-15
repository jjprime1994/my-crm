import pg from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Find Marcus
  const userRes = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u."coveredStates", mgr.name AS manager, mgr."coveredStates" AS mgr_covered
    FROM "User" u
    LEFT JOIN "User" mgr ON mgr.id = u."managerId"
    WHERE u.name ILIKE '%marcus%'
  `)

  if (userRes.rows.length === 0) {
    console.log("No user named Marcus found.")
    return
  }

  console.log("=== Marcus user record ===")
  userRes.rows.forEach((r: any) =>
    console.log(`  ${r.name} | ${r.email} | role=${r.role} | coveredStates=${JSON.stringify(r.coveredStates)} | manager=${r.manager} | mgr_covers=${JSON.stringify(r.mgr_covered)}`)
  )

  for (const marcus of userRes.rows) {
    // All his leads
    const leadsRes = await pool.query(`
      SELECT l.id, l."firstName", l."lastName", l.branch, l."campaignName", l.status, l."claimedAt",
             CASE WHEN l."claimedAt" IS NOT NULL THEN 'SELF-CLAIMED' ELSE 'AUTO-ASSIGNED' END AS assignment_type
      FROM "Lead" l
      WHERE l."assignedToId" = $1
      ORDER BY l."createdAt" DESC
    `, [marcus.id])

    console.log(`\n=== ${marcus.name}'s leads (${leadsRes.rows.length} total) ===`)

    const wrongLeads = leadsRes.rows.filter((l: any) =>
      l.claimedAt === null &&
      l.branch !== null &&
      marcus.mgr_covered?.length > 0 &&
      !marcus.mgr_covered.includes(l.branch)
    )

    console.log(`\nWRONGLY AUTO-ASSIGNED (state mismatch): ${wrongLeads.length}`)
    wrongLeads.forEach((l: any) =>
      console.log(`  ${l.id} | ${l.firstName} ${l.lastName} | branch=${l.branch} | campaign=${l.campaignName} | status=${l.status}`)
    )

    const selfClaimed = leadsRes.rows.filter((l: any) => l.claimedAt !== null)
    console.log(`\nSELF-CLAIMED: ${selfClaimed.length}`)
    selfClaimed.forEach((l: any) =>
      console.log(`  ${l.id} | ${l.firstName} ${l.lastName} | branch=${l.branch} | campaign=${l.campaignName} | status=${l.status}`)
    )

    const correctAuto = leadsRes.rows.filter((l: any) =>
      l.claimedAt === null && !wrongLeads.includes(l)
    )
    console.log(`\nCORRECTLY AUTO-ASSIGNED (or no state): ${correctAuto.length}`)
    correctAuto.forEach((l: any) =>
      console.log(`  ${l.id} | ${l.firstName} ${l.lastName} | branch=${l.branch} | campaign=${l.campaignName} | status=${l.status}`)
    )
  }
}

main().catch(console.error).finally(() => pool.end())
