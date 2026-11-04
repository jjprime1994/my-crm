// Seed / clear DEMO commission claims so the MA & LA pages can be previewed.
// Every demo row has createdById = "demo-seed" and a "[DEMO]" customer name prefix.
// Daily activity demo rows are marked with updatedById = "demo-seed".
// Usage:  npx tsx scripts/demo-commission.ts             → seed claims for current month
//         npx tsx scripts/demo-commission.ts --activity  → seed daily activity (last 15 days)
//         npx tsx scripts/demo-commission.ts --teams     → add claims + activity for every other manager's team
//         npx tsx scripts/demo-commission.ts --super     → add claims + activity for the other Super Admins
//         npx tsx scripts/demo-commission.ts --clear     → delete all demo rows (claims + activity)
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = ".env.development.local"
for (const line of readFileSync(resolve(process.cwd(), envFile), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

const DEMO = "demo-seed"

async function main() {
  const { db } = await import("../src/lib/db")
  const { currentMonthMYT } = await import("../src/lib/commission")

  if (process.argv.includes("--clear")) {
    const { count } = await db.commissionClaim.deleteMany({ where: { createdById: DEMO } })
    const act = await db.dailyActivity.deleteMany({ where: { updatedById: DEMO } })
    console.log(`Deleted ${count} demo claim rows and ${act.count} demo daily-activity rows.`)
    return
  }

  if (process.argv.includes("--activity")) {
    const { todayMYT } = await import("../src/lib/commission")
    // Same people the claims were seeded for
    const ids = [...new Set((await db.commissionClaim.findMany({ where: { createdById: DEMO }, select: { userId: true } })).map((c) => c.userId))]
    if (ids.length === 0) throw new Error("Seed claims first (run without flags) so the same people are used.")
    const today = todayMYT()
    let n = 0, skipped = 0
    for (const [pi, userId] of ids.entries()) {
      for (let back = 0; back < 15; back++) {
        const date = new Date(Date.parse(today + "T00:00:00Z") - back * 86400000).toISOString().slice(0, 10)
        if (back === 0 && pi === ids.length - 1) continue // leave one person "not entered yet" for today
        // deterministic pseudo-random numbers per person/day
        const seed = (pi * 31 + back * 17) % 23
        const leads = 2 + (seed % 9)
        const appointments = Math.min(leads, seed % 4)
        const existing = await db.dailyActivity.findUnique({ where: { userId_date: { userId, date } } })
        if (existing) { skipped++; continue } // never overwrite real entries
        await db.dailyActivity.create({ data: { userId, date, leadsCount: leads, appointmentsCount: appointments, updatedById: DEMO } })
        n++
      }
    }
    console.log(`Seeded ${n} demo daily-activity rows (${skipped} days skipped because real entries exist) for ${ids.length} people.`)
    return
  }

  if (process.argv.includes("--super")) {
    // Demo claims + daily activity for every Super Admin that doesn't have demo data yet
    const { todayMYT } = await import("../src/lib/commission")
    const month = currentMonthMYT()
    const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`
    const seeded = new Set((await db.commissionClaim.findMany({ where: { createdById: DEMO }, select: { userId: true } })).map((c) => c.userId))
    const sas = (await db.user.findMany({ where: { role: "SUPER_ADMIN", disabled: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }))
      .filter((s) => !seeded.has(s.id))
    const today = todayMYT()
    let claims = 0, acts = 0
    for (const [i, s] of sas.entries()) {
      const amt = 600 + i * 250
      await db.commissionClaim.create({ data: {
        kind: "MA", month, userId: s.id, createdById: DEMO, updatedById: DEMO,
        branch: ["Kuala Lumpur", "Selangor", "PG", "JB"][i % 4], customerName: `[DEMO] Syarikat Contoh ${i + 1} Sdn Bhd`,
        commissionType: "Sales Overriding", packageType: "Cashout", machineType: "MMAP", poNo: `PO-26-${3000 + i}`,
        poDate: d(4 + i), sellingPrice: 18000, totalCollection: 18000, lastPaymentDate: d(6 + i), machineCount: 1, kpi: 1,
        incentive: 250, paymentMadePct: 100, amountClaim: amt,
      } })
      await db.commissionClaim.create({ data: {
        kind: "LA", month, userId: s.id, createdById: DEMO, updatedById: DEMO,
        branch: ["Kuala Lumpur", "Selangor", "PG", "JB"][i % 4], customerName: `[DEMO] Syarikat Contoh ${i + 1} Sdn Bhd`,
        commissionType: "Location Commission", packageType: "Rental", machinePoNo: `PO-26-${3000 + i}`,
        locationPoNo: `LPO-26-${700 + i}`, locationName: `Contoh Plaza ${i + 1}, Ground Floor`, paymentMadePct: 100, amountClaim: 150 + i * 50,
      } })
      claims += 2
      for (let back = 0; back < 15; back++) {
        const date = new Date(Date.parse(today + "T00:00:00Z") - back * 86400000).toISOString().slice(0, 10)
        if (await db.dailyActivity.findUnique({ where: { userId_date: { userId: s.id, date } } })) continue
        const seed = (i * 11 + back * 5) % 17
        await db.dailyActivity.create({ data: { userId: s.id, date, leadsCount: 1 + (seed % 6), appointmentsCount: seed % 3, updatedById: DEMO } })
        acts++
      }
    }
    console.log(`Seeded ${claims} demo claims and ${acts} activity rows for: ${sas.map((s) => s.name).join(", ") || "(none needed)"}`)
    return
  }

  if (process.argv.includes("--teams")) {
    // Add demo claims + daily activity for every other manager's team (manager + up to 2 people below)
    const { todayMYT } = await import("../src/lib/commission")
    const month = currentMonthMYT()
    const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`
    const seeded = new Set((await db.commissionClaim.findMany({ where: { createdById: DEMO }, select: { userId: true } })).map((c) => c.userId))
    const admins = await db.user.findMany({ where: { role: "ADMIN", disabled: false }, select: { id: true, name: true, teamName: true }, orderBy: { name: "asc" } })
    const branches = ["Kuala Lumpur", "Selangor", "JB", "PG", "Melaka", "Perak", "Kedah", "Sabah"]
    const machines = ["MMAP", "MMAA+", "Coffee Platinum", "AI Smart Fridge", "MMHFM (2M)"]
    const places = ["Klinik Kesihatan", "Pasaraya", "Kilang", "Sekolah", "Pejabat", "Hotel", "Gym", "Hostel"]
    const today = todayMYT()
    let claims = 0, acts = 0
    const summary: string[] = []
    for (const [ti, admin] of admins.entries()) {
      if (seeded.has(admin.id)) continue // team already has demo data (e.g. Jack See)
      const below = await db.user.findMany({
        where: { disabled: false, OR: [{ managerId: admin.id }, { manager: { managerId: admin.id } }] },
        select: { id: true }, orderBy: [{ role: "asc" }, { name: "asc" }], take: 2,
      })
      const people = [admin.id, ...below.map((b) => b.id)].filter((id) => !seeded.has(id))
      for (const [pi, userId] of people.entries()) {
        const k = ti * 7 + pi * 3
        const branch = branches[k % branches.length]
        const nMa = 1 + (k % 2)
        for (let j = 0; j < nMa; j++) {
          const s = k + j
          const machineCount = 1 + (s % 3)
          const price = 15000 + (s % 5) * 4500
          const pct = s % 2 === 0 ? 100 : 50
          const place = `${places[s % places.length]} ${branch}`
          const poNo = `PO-26-${2000 + ti * 10 + pi * 3 + j}`
          await db.commissionClaim.create({ data: {
            kind: "MA", month, userId, createdById: DEMO, updatedById: DEMO,
            branch, customerName: `[DEMO] ${place}`, commissionType: s % 2 ? "Introducer" : "Sales Overriding",
            packageType: ["Cashout", "Installment", "Rental", "AR"][s % 4], machineType: machines[s % machines.length],
            poNo, poDate: d(2 + (s % 20)), sellingPrice: price, totalCollection: (price * pct) / 100,
            lastPaymentDate: d(3 + (s % 20)), machineCount, kpi: machineCount, incentive: s % 3 === 0 ? 0 : 250,
            paymentMadePct: pct, amountClaim: 400 + (s % 6) * 150,
          } })
          claims++
          if (j === 0 && pi !== 1) {
            await db.commissionClaim.create({ data: {
              kind: "LA", month, userId, createdById: DEMO, updatedById: DEMO,
              branch, customerName: `[DEMO] ${place}`, commissionType: s % 3 ? "Location Commission" : "Location Overriding",
              packageType: ["Cashout", "Installment", "Rental", "AR"][s % 4], machinePoNo: poNo,
              locationPoNo: `LPO-26-${600 + ti * 10 + pi}`, locationName: `${place}, Lobby`,
              paymentMadePct: pct, amountClaim: 100 + (s % 4) * 50,
            } })
            claims++
          }
        }
        for (let back = 0; back < 15; back++) {
          const date = new Date(Date.parse(today + "T00:00:00Z") - back * 86400000).toISOString().slice(0, 10)
          if (back === 0 && pi === people.length - 1 && ti % 2 === 0) continue // some teams have someone not entered today
          const seed = (k * 13 + back * 7) % 19
          const exists = await db.dailyActivity.findUnique({ where: { userId_date: { userId, date } } })
          if (exists) continue
          await db.dailyActivity.create({ data: { userId, date, leadsCount: 1 + (seed % 8), appointmentsCount: Math.min(1 + (seed % 8), seed % 4), updatedById: DEMO } })
          acts++
        }
      }
      if (people.length) summary.push(`${admin.teamName || admin.name} (${people.length})`)
    }
    console.log(`Seeded ${claims} demo claims and ${acts} daily-activity rows for ${month} across teams: ${summary.join(", ")}`)
    return
  }

  const existing = await db.commissionClaim.count({ where: { createdById: DEMO } })
  if (existing > 0) {
    console.log(`${existing} demo rows already exist — run with --clear first to reseed.`)
    return
  }

  // Pick a small slice of the real hierarchy: an admin who has a team, one of their team
  // leaders (if any), and a couple of salespeople under them, plus the super admin.
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", disabled: false, teamMembers: { some: { disabled: false } } },
    select: { id: true, name: true },
  })
  const superAdmin = await db.user.findFirst({ where: { role: "SUPER_ADMIN", disabled: false }, select: { id: true, name: true } })
  const below = admin
    ? await db.user.findMany({
        where: { disabled: false, OR: [{ managerId: admin.id }, { manager: { managerId: admin.id } }] },
        select: { id: true, name: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        take: 3,
      })
    : []
  const people = [superAdmin, admin, ...below].filter((p): p is { id: string; name: string } => !!p)
  if (people.length === 0) throw new Error("No users found")

  const month = currentMonthMYT()
  const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`

  const ma = [
    { branch: "JB", customerName: "[DEMO] Kedai Runcit Maju Sdn Bhd", commissionType: "Sales Overriding", packageType: "Cashout", machineType: "MMAP", poNo: "PO-26-1101", poDate: d(2), sellingPrice: 18500, totalCollection: 18500, lastPaymentDate: d(5), machineCount: 1, kpi: 1, incentive: 250, paymentMadePct: 100, amountClaim: 1000 },
    { branch: "PG", customerName: "[DEMO] Hospital Seri Pinang", commissionType: "Introducer", packageType: "Installment", machineType: "MMAA+", poNo: "PO-26-1102", poDate: d(3), sellingPrice: 24000, totalCollection: 12000, lastPaymentDate: d(8), machineCount: 2, kpi: 2, incentive: 250, paymentMadePct: 50, amountClaim: 750 },
    { branch: "Kuala Lumpur", customerName: "[DEMO] Menara Cahaya Office Tower", commissionType: "Sales Overriding", packageType: "Rental", machineType: "Coffee Platinum", poNo: "PO-26-1103", poDate: d(6), sellingPrice: 32000, totalCollection: 32000, lastPaymentDate: d(6), machineCount: 1, kpi: 1, incentive: 500, paymentMadePct: 100, amountClaim: 1500 },
    { branch: "JB", customerName: "[DEMO] Kilang Elektronik Pasir Gudang", commissionType: "Location Overriding", packageType: "AR", machineType: "MMHFM (2M)", poNo: "PO-26-1104", poDate: d(9), sellingPrice: 41000, totalCollection: 20500, lastPaymentDate: d(12), machineCount: 3, kpi: 3, incentive: 0, paymentMadePct: 50, amountClaim: 2050 },
    { branch: "Selangor", customerName: "[DEMO] Kolej Universiti Shah Alam", commissionType: "Introducer", packageType: "Cashout", machineType: "AI Smart Fridge", poNo: "PO-26-1105", poDate: d(10), sellingPrice: 15800, totalCollection: 15800, lastPaymentDate: d(10), machineCount: 1, kpi: 1, incentive: 250, paymentMadePct: 100, amountClaim: 800 },
  ]
  const la = [
    { branch: "JB", customerName: "[DEMO] Kedai Runcit Maju Sdn Bhd", commissionType: "Location Commission", packageType: "Rental", machinePoNo: "PO-26-1101", locationPoNo: "LPO-26-501", locationName: "AEON Tebrau City, Level 1", paymentMadePct: 100, amountClaim: 300 },
    { branch: "PG", customerName: "[DEMO] Hospital Seri Pinang", commissionType: "Location Commission", packageType: "Installment", machinePoNo: "PO-26-1102", locationPoNo: "LPO-26-502", locationName: "Hospital Seri Pinang, Lobby A", paymentMadePct: 50, amountClaim: 150 },
    { branch: "Kuala Lumpur", customerName: "[DEMO] Menara Cahaya Office Tower", commissionType: "Location Overriding", packageType: "Rental", machinePoNo: "PO-26-1103", locationPoNo: "LPO-26-503", locationName: "Menara Cahaya, Pantry L12", paymentMadePct: 100, amountClaim: 200 },
    { branch: "Selangor", customerName: "[DEMO] Kolej Universiti Shah Alam", commissionType: "Location Commission", packageType: "Cashout", machinePoNo: "PO-26-1105", locationPoNo: "LPO-26-504", locationName: "KUSA Student Centre", paymentMadePct: 100, amountClaim: 250 },
  ]

  // Spread rows across people so each person gets their own "Name:" block
  let n = 0
  for (const [i, row] of ma.entries()) {
    const p = people[i % people.length]
    await db.commissionClaim.create({ data: { ...row, kind: "MA", month, userId: p.id, createdById: DEMO, updatedById: DEMO } })
    n++
  }
  for (const [i, row] of la.entries()) {
    const p = people[(i + 1) % people.length]
    await db.commissionClaim.create({ data: { ...row, kind: "LA", month, userId: p.id, createdById: DEMO, updatedById: DEMO } })
    n++
  }
  console.log(`Seeded ${n} demo rows for ${month} across: ${people.map((p) => p.name).join(", ")}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
