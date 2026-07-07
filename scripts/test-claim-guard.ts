// Verifies isLeadClaimableBy (the claim endpoint's new server-side guard)
// against live data: for a few users, every lead in their available pool must be
// claimable, and known out-of-pool leads must be rejected. Read-only.
//
// Usage:  npx tsx scripts/test-claim-guard.ts [.env.production.local]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.production.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const { getAvailableLeads, isLeadClaimableBy } = await import("../src/lib/available-leads")

  let failures = 0
  const expect = async (cond: boolean, label: string) => {
    console.log(`${cond ? "  ok " : "  FAIL"}  ${label}`)
    if (!cond) failures++
  }

  // Users across the routing shapes: state-route member, state-covered team,
  // default team, unrestricted team.
  const names = ["Choo Yun Wah", "Willam Tan", "Wan Luqman", "Jocelyn", "Amar", "FUAD YUSOF"]
  const users = await db.user.findMany({ where: { name: { in: names } }, select: { id: true, name: true, role: true } })

  // The "Inhouse Event" leads are routed to teams that exclude Jack See's — his
  // salespeople must be rejected. (These specific ones are claimed; the guard
  // only looks at adName/branch, so shape-wise this is the exact claim check.)
  const eventLead = { adName: "Inhouse Event  20-21 June", branch: null }
  const johorLead = { adName: null, branch: "Johor" }
  const penangLead = { adName: null, branch: "Penang" }

  for (const u of users) {
    console.log(`\n${u.name} (${u.role}):`)
    const pool = await getAvailableLeads(u.id, u.role)

    // Everything visible in the pool must be claimable — count==list==claimable
    let poolOk = true
    for (const lead of pool) {
      if (!(await isLeadClaimableBy(u.id, u.role, lead))) {
        poolOk = false
        console.log(`       pool lead ${lead.id} (ad "${lead.adName}", state ${lead.branch}) NOT claimable`)
      }
    }
    await expect(poolOk, `all ${pool.length} pool leads are claimable`)

    if (u.name === "Choo Yun Wah" || u.name === "Willam Tan") {
      await expect(!(await isLeadClaimableBy(u.id, u.role, eventLead)), `rejected for "Inhouse Event" lead (other teams' ad route)`)
      await expect(await isLeadClaimableBy(u.id, u.role, johorLead), `allowed for a no-ad Johor lead (their coverage)`)
      await expect(!(await isLeadClaimableBy(u.id, u.role, penangLead)), `rejected for a no-ad Penang lead (outside coverage)`)
    }
    if (u.name === "Wan Luqman") {
      await expect(!(await isLeadClaimableBy(u.id, u.role, { adName: null, branch: "Selangor" })), `rejected for a Selangor lead (he's Kelantan state route)`)
      await expect(await isLeadClaimableBy(u.id, u.role, { adName: null, branch: "Kelantan" }), `allowed for a Kelantan lead`)
    }
  }

  console.log(failures === 0 ? "\n✅ Claim guard matches pool visibility everywhere tested." : `\n❌ ${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
