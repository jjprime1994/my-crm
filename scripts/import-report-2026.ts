// One-off: import Jan–Sep 2026 rows from "Sales and Location Report 2026.xlsx" (pre-extracted to JSON)
// into PerformanceReport. Skips rows already present (same person, month, kind, customer, figures).
// Usage: npx tsx scripts/import-report-2026.ts <rows.json> <map.json> [--write]
import { readFileSync } from "node:fs"
for (const line of readFileSync(".env.development.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}
type X = { sheet: string; month: string; kind: "SALES" | "LOCATION"; customer: string; sp?: number | null; col?: number | null; pkg?: string | null; desc?: string | null; type?: string | null }

async function main() {
  const [rowsPath, mapPath] = process.argv.slice(2)
  const write = process.argv.includes("--write")
  const { db } = await import("../src/lib/db")
  const { REPORT_PACKAGE_SUGGESTIONS, LOCATION_TYPES } = await import("../src/lib/report")
  const rows: X[] = JSON.parse(readFileSync(rowsPath, "utf8"))
  const map: Record<string, string> = JSON.parse(readFileSync(mapPath, "utf8"))
  const users = await db.user.findMany({ select: { id: true, name: true } })
  const idOf = new Map(users.map((u) => [u.name.trim(), u.id]))
  const missing = [...new Set(Object.values(map))].filter((n) => !idOf.has(n))
  if (missing.length) throw new Error("Users not found: " + missing.join(", "))
  const unmapped = [...new Set(rows.map((r) => r.sheet))].filter((s) => !map[s])
  if (unmapped.length) throw new Error("Sheets not mapped: " + unmapped.join(", "))

  // Same spelling for case/space variants only (AR3I → AR3i, CASH OUT → Cashout); anything else kept as typed
  const canon = new Map([...REPORT_PACKAGE_SUGGESTIONS, ...LOCATION_TYPES].map((p) => [p.toLowerCase().replace(/\s+/g, ""), p as string]))
  const norm = (v: string | null | undefined) => {
    if (v === null || v === undefined) return null
    const t = String(v).trim().replace(/\s+/g, " ")
    return t ? canon.get(t.toLowerCase().replace(/\s+/g, "")) ?? t : null
  }
  const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)

  const data = rows.map((r) => ({
    kind: r.kind,
    userId: idOf.get(map[r.sheet])!,
    month: r.month,
    customerName: String(r.customer).trim().replace(/\s+/g, " ").slice(0, 300),
    ...(r.kind === "SALES"
      ? { sellingPrice: money(r.sp), collection: money(r.col), packageType: norm(r.pkg) }
      : { locationDescription: r.desc ? String(r.desc).trim().slice(0, 300) : null, locationType: norm(r.type) }),
  }))

  const existing = await db.performanceReport.findMany()
  const key = (d: { kind: string; userId: string; month: string; customerName: string; sellingPrice?: unknown; collection?: unknown; locationDescription?: string | null }) =>
    [d.kind, d.userId, d.month, d.customerName.toLowerCase(), d.sellingPrice == null ? "" : Number(d.sellingPrice), d.collection == null ? "" : Number(d.collection), d.locationDescription ?? ""].join("|")
  const have = new Set(existing.map(key))
  const toAdd = data.filter((d) => !have.has(key(d)))

  console.log(`Excel rows: ${data.length} | already in CRM: ${data.length - toAdd.length} | to add: ${toAdd.length} (${toAdd.filter((d) => d.kind === "SALES").length} sales, ${toAdd.filter((d) => d.kind === "LOCATION").length} locations)`)
  if (!write) { console.log("Dry run — pass --write to insert."); await db.$disconnect(); return }
  const res = await db.performanceReport.createMany({ data: toAdd })
  console.log("Inserted:", res.count, "| table now has:", await db.performanceReport.count())
  await db.$disconnect()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
