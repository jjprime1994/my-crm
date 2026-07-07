// Read-only: can Johnny (and his team) see WEBSITE leads in the claim pool?
// Usage: npx tsx scripts/check-johnny-website-leads.ts .env.production.local

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = process.argv[2] ?? ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

async function main() {
  const { db } = await import("../src/lib/db")
  const { getAvailableLeads, getEffectiveAdmin } = await import("../src/lib/available-leads")

  // Current unassigned WEBSITE leads
  const websiteLeads = await db.lead.findMany({
    where: { source: "WEBSITE" },
    select: { id: true, firstName: true, lastName: true, branch: true, assignedToId: true, status: true },
  })
  console.log("=== WEBSITE leads ===")
  console.table(websiteLeads)

  // Find Johnny
  const johnnys = await db.user.findMany({
    where: { name: { contains: "johnny", mode: "insensitive" } },
    select: { id: true, name: true, role: true, managerId: true, manager: { select: { name: true, role: true } } },
  })
  if (johnnys.length === 0) { console.log("No user matching 'johnny' found."); return }

  for (const j of johnnys) {
    console.log(`\n=== ${j.name} (${j.role}) — manager: ${j.manager?.name ?? "none"} ===`)

    const stateRoutes = await db.stateRoute.findMany({
      where: { userIds: { has: j.id } },
      select: { state: true },
    })
    console.log(`StateRoutes: ${stateRoutes.length > 0 ? stateRoutes.map((r) => r.state).join(", ") : "none"}`)

    const admin = await getEffectiveAdmin(j.id, j.role)
    console.log(`Effective admin: ${admin ? `${admin.id} coveredStates=[${admin.coveredStates.join(", ")}] default=${admin.isDefaultTeam}` : "none"}`)

    const pool = await getAvailableLeads(j.id, j.role)
    const websiteInPool = pool.filter((l) => l.source === "WEBSITE")
    console.log(`Claim pool size: ${pool.length}`)
    console.log(`WEBSITE leads in pool: ${websiteInPool.length}`)
    for (const l of websiteInPool) console.log(`  - ${l.firstName} ${l.lastName} (${l.branch})`)
  }
}

main().then(() => process.exit(0))
