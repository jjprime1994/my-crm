import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { isSuperAdmin } from "@/lib/roles"
import { comparePeople, isMonthStr, monthLabel, serializeClaim, type CommissionRow } from "@/lib/commission"
import { getScopedUsers } from "@/lib/team-scope"
import { canViewCommission } from "@/lib/app-settings"

type Col = { header: string; width: number; get: (r: CommissionRow, i: number) => string | number | null; money?: boolean }

const MA_COLS: Col[] = [
  { header: "No.", width: 5, get: (_r, i) => i + 1 },
  { header: "Branch", width: 12, get: (r) => r.branch },
  { header: "Customer Name (As per PO Name)", width: 32, get: (r) => r.customerName },
  { header: "Types of Commission", width: 20, get: (r) => r.commissionType },
  { header: "Package Type", width: 13, get: (r) => r.packageType },
  { header: "Type of Machine", width: 16, get: (r) => r.machineType },
  { header: "PO No", width: 14, get: (r) => r.poNo },
  { header: "PO Date", width: 12, get: (r) => r.poDate },
  { header: "Selling Price (RM)", width: 15, get: (r) => r.sellingPrice, money: true },
  { header: "Total Collection Amount", width: 17, get: (r) => r.totalCollection, money: true },
  { header: "Last Payment Date", width: 14, get: (r) => r.lastPaymentDate },
  { header: "No of Machine", width: 10, get: (r) => r.machineCount },
  { header: "KPI", width: 9, get: (r) => r.kpi },
  { header: "Incentive (RM)", width: 13, get: (r) => r.incentive, money: true },
  { header: "Payment Made (%)", width: 12, get: (r) => r.paymentMadePct },
  { header: "Amount Claim (RM)", width: 15, get: (r) => r.amountClaim, money: true },
]
const MA_SUM = ["Total Collection Amount", "No of Machine", "KPI", "Amount Claim (RM)"]

const LA_COLS: Col[] = [
  { header: "No.", width: 5, get: (_r, i) => i + 1 },
  { header: "Branch", width: 12, get: (r) => r.branch },
  { header: "Customer Name (As per PO Name)", width: 32, get: (r) => r.customerName },
  { header: "Types of Commission", width: 20, get: (r) => r.commissionType },
  { header: "Package Type", width: 13, get: (r) => r.packageType },
  { header: "Machine PO No", width: 15, get: (r) => r.machinePoNo },
  { header: "Location PO No", width: 15, get: (r) => r.locationPoNo },
  { header: "Location Name", width: 26, get: (r) => r.locationName },
  { header: "Payment Made (%)", width: 12, get: (r) => r.paymentMadePct },
  { header: "Amount Claim (RM)", width: 15, get: (r) => r.amountClaim, money: true },
]
const LA_SUM = ["Amount Claim (RM)"]

const thin = { style: "thin" as const }
const border = { top: thin, left: thin, bottom: thin, right: thin }

// GET /api/commission/export?kind=MA|LA&month=YYYY-MM — SUPER_ADMIN only.
// Mirrors the layout of Commission Templete 2026.xlsx: one "Name:" block per person + TOTAL row.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) return new NextResponse("Forbidden", { status: 403 })
  if (!(await canViewCommission(session.user.id))) return new NextResponse("Forbidden", { status: 403 })

  const kind = req.nextUrl.searchParams.get("kind")
  const month = req.nextUrl.searchParams.get("month")
  if ((kind !== "MA" && kind !== "LA") || !isMonthStr(month)) return new NextResponse("kind and month required", { status: 400 })

  const claims = await db.commissionClaim.findMany({
    where: { kind, month },
    include: { user: { select: { name: true } } },
    orderBy: [{ user: { name: "asc" } }, { createdAt: "asc" }],
  })

  const byUser = new Map<string, { name: string; rows: CommissionRow[] }>()
  for (const c of claims) {
    const g = byUser.get(c.userId) ?? { name: c.user.name, rows: [] }
    g.rows.push(serializeClaim(c))
    byUser.set(c.userId, g)
  }

  // Same order as the MA/LA pages: Super Admin(s) on top, then each team with its manager first.
  const people = new Map(
    (await getScopedUsers(session.user.id, "SUPER_ADMIN")).map((u) => [u.id, { id: u.id, name: u.name, role: u.role, team: u.teamLabel }])
  )
  const blocks = [...byUser.entries()]
    .sort(([a], [b]) => {
      const pa = people.get(a) ?? { id: a, name: byUser.get(a)!.name, role: "SALESPERSON", team: null }
      const pb = people.get(b) ?? { id: b, name: byUser.get(b)!.name, role: "SALESPERSON", team: null }
      return comparePeople(pa, pb, session.user.id)
    })
    .map(([, g]) => g)

  const cols = kind === "MA" ? MA_COLS : LA_COLS
  const sumCols = kind === "MA" ? MA_SUM : LA_SUM
  const title = kind === "MA" ? "SALES COMMISSION" : "LOCATION COMMISSION"

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`${kind} ${month}`)
  cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.width))

  ws.getCell("A1").value = "REGION (BRANCH)"
  ws.getCell("D1").value = `NU VENDING SDN BHD - ${title} FOR (${monthLabel(month)})`
  ws.getCell("D1").font = { bold: true, size: 14 }

  const grandRow = ws.getRow(3)
  grandRow.getCell(1).value = "GRAND TOTAL (all staff)"
  grandRow.getCell(1).font = { bold: true }
  const totalRowNums: number[] = []

  let r = 5
  for (const { name, rows } of blocks) {
    ws.getCell(r, 1).value = "Name:"
    ws.getCell(r, 2).value = name
    ws.getRow(r).font = { bold: true }
    r++

    ws.mergeCells(r, 1, r, cols.length)
    ws.getCell(r, 1).value = `${monthLabel(month)} COMMISSION`
    ws.getCell(r, 1).alignment = { horizontal: "center" }
    ws.getCell(r, 1).font = { bold: true }
    ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }
    r++

    const header = ws.getRow(r)
    cols.forEach((c, i) => {
      const cell = header.getCell(i + 1)
      cell.value = c.header
      cell.font = { bold: true }
      cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }
      cell.border = border
    })
    header.height = 32
    r++

    const first = r
    rows.forEach((row, idx) => {
      const xr = ws.getRow(r)
      cols.forEach((c, i) => {
        const cell = xr.getCell(i + 1)
        cell.value = c.get(row, idx)
        cell.border = border
        if (c.money) cell.numFmt = "#,##0.00"
      })
      r++
    })
    const last = r - 1

    const tr = ws.getRow(r)
    tr.getCell(1).value = "TOTAL AMOUNT"
    tr.font = { bold: true }
    cols.forEach((c, i) => {
      const cell = tr.getCell(i + 1)
      cell.border = border
      if (sumCols.includes(c.header)) {
        const L = ws.getColumn(i + 1).letter
        cell.value = { formula: `SUM(${L}${first}:${L}${last})` }
        if (c.money) cell.numFmt = "#,##0.00"
      }
    })
    totalRowNums.push(r)
    r += 3
  }

  // Grand total across every person's TOTAL row
  cols.forEach((c, i) => {
    if (!sumCols.includes(c.header) || totalRowNums.length === 0) return
    const L = ws.getColumn(i + 1).letter
    const cell = grandRow.getCell(i + 1)
    cell.value = { formula: totalRowNums.map((n) => `${L}${n}`).join("+") }
    cell.font = { bold: true }
    if (c.money) cell.numFmt = "#,##0.00"
  })
  if (totalRowNums.length === 0) ws.getCell("A5").value = "No claims submitted for this month."

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-commission-${month}.xlsx"`,
    },
  })
}
