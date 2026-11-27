import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { isMonthStr, monthLabel } from "@/lib/commission"
import { collectionPct, serializeReport, type ReportRow } from "@/lib/report"
import { getScopedUsers } from "@/lib/team-scope"
import { groupByHierarchy, roleLabel } from "@/lib/hierarchy"
import { canViewCommission } from "@/lib/app-settings"

const thin = { style: "thin" as const }
const border = { top: thin, left: thin, bottom: thin, right: thin }
const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } })

// Columns follow Sales and Location Report 2026.xlsx: Sales in A–F, gap in G, Location in H–K.
const SALES_HEAD = ["No", "Customer", "Selling Price", "Collection (RM)", "Collection (%)", "Package Type"]
const LOC_HEAD = ["No", "Customer", "Location Description", "Type"]
const WIDTHS = [5, 30, 14, 15, 13, 16, 3, 5, 28, 32, 14]

// GET /api/report/export?month=YYYY-MM — SUPER_ADMIN only. One block per person, grouped by team.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  if (!(await canViewCommission(session.user.id))) return new NextResponse("Forbidden", { status: 403 })

  const month = req.nextUrl.searchParams.get("month")
  if (!isMonthStr(month)) return new NextResponse("month required", { status: 400 })

  const rows = await db.performanceReport.findMany({
    where: { month },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  const byUser = new Map<string, { name: string; sales: ReportRow[]; locs: ReportRow[] }>()
  for (const r of rows) {
    const g = byUser.get(r.userId) ?? { name: r.user.name, sales: [], locs: [] }
    ;(r.kind === "SALES" ? g.sales : g.locs).push(serializeReport(r))
    byUser.set(r.userId, g)
  }

  const scoped = await getScopedUsers(session.user.id, "SUPER_ADMIN")
  const groups = groupByHierarchy(scoped)
    .map((g) => ({
      label: g.label,
      blocks: g.people.filter((p) => byUser.has(p.user.id)).map((p) => ({ ...byUser.get(p.user.id)!, role: p.user.role, depth: p.depth })),
    }))
    .filter((g) => g.blocks.length > 0)
  const placed = new Set(scoped.map((u) => u.id))
  const orphans = [...byUser.entries()].filter(([id]) => !placed.has(id)).map(([, g]) => ({ ...g, role: "SALESPERSON", depth: 0 }))
  if (orphans.length) groups.push({ label: "Other", blocks: orphans })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Report ${month}`)
  WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells(1, 1, 1, 11)
  ws.getCell("A1").value = `Location & Sales Performance Report Details - ${monthLabel(month)}`
  ws.getCell("A1").font = { bold: true, size: 14 }

  const grand = ws.getRow(3)
  grand.getCell(1).value = "GRAND TOTAL (all staff)"
  grand.font = { bold: true }
  const totalRows: number[] = []
  let locCount = 0

  const header = (r: number, col: number, heads: string[]) =>
    heads.forEach((h, i) => {
      const c = ws.getCell(r, col + i)
      c.value = h
      c.font = { bold: true }
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
      c.fill = solid("FFD9E1F2")
      c.border = border
    })

  let r = 5
  for (const group of groups) {
    ws.mergeCells(r, 1, r, 11)
    const th = ws.getCell(r, 1)
    th.value = `TEAM: ${group.label.toUpperCase()}`
    th.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } }
    th.fill = solid("FF1F4E78")
    ws.getRow(r).height = 22
    r += 2

    for (const b of group.blocks) {
      ws.getCell(r, 1).value = "Name:"
      ws.getCell(r, 2).value = `${"    ".repeat(b.depth)}${b.name}`
      ws.getCell(r, 4).value = roleLabel(b.role)
      ws.getRow(r).font = { bold: true }
      r++

      ws.mergeCells(r, 1, r, 6)
      ws.mergeCells(r, 8, r, 11)
      for (const [col, label] of [[1, "Sales"], [8, "Location"]] as const) {
        const c = ws.getCell(r, col)
        c.value = label
        c.font = { bold: true }
        c.alignment = { horizontal: "center" }
        c.fill = solid("FFFFF2CC")
      }
      r++
      header(r, 1, SALES_HEAD)
      header(r, 8, LOC_HEAD)
      r++

      const n = Math.max(b.sales.length, b.locs.length, 1)
      const first = r
      for (let i = 0; i < n; i++) {
        const s = b.sales[i]
        const l = b.locs[i]
        const salesVals = s ? [i + 1, s.customerName, s.sellingPrice, s.collection, collectionPct(s), s.packageType] : [null, null, null, null, null, null]
        const locVals = l ? [i + 1, l.customerName, l.locationDescription, l.locationType] : [null, null, null, null]
        salesVals.forEach((v, j) => {
          const c = ws.getCell(r, 1 + j)
          c.value = j === 4 && typeof v === "number" ? v / 100 : v
          c.border = border
          if (j === 2 || j === 3) c.numFmt = "#,##0.00"
          if (j === 4) c.numFmt = "0%"
        })
        locVals.forEach((v, j) => {
          const c = ws.getCell(r, 8 + j)
          c.value = v
          c.border = border
        })
        r++
      }
      const last = r - 1
      locCount += b.locs.length

      const tr = ws.getRow(r)
      tr.font = { bold: true }
      tr.getCell(2).value = "Total"
      for (const col of [3, 4]) {
        const L = ws.getColumn(col).letter
        tr.getCell(col).value = { formula: `SUM(${L}${first}:${L}${last})` }
        tr.getCell(col).numFmt = "#,##0.00"
      }
      tr.getCell(9).value = "Total locations"
      tr.getCell(10).value = b.locs.length
      for (const col of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11]) tr.getCell(col).border = border
      totalRows.push(r)
      r += 3
    }
    r += 1
  }

  if (totalRows.length) {
    for (const col of [3, 4]) {
      const L = ws.getColumn(col).letter
      grand.getCell(col).value = { formula: totalRows.map((n) => `${L}${n}`).join("+") }
      grand.getCell(col).numFmt = "#,##0.00"
    }
    grand.getCell(9).value = "Total locations"
    grand.getCell(10).value = locCount
  } else {
    ws.getCell("A5").value = "No reports submitted for this month."
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-location-report-${month}.xlsx"`,
    },
  })
}
