// Shared constants/helpers for the commission (MA / LA) and daily activity features.
// Dropdown values come from the "Code" sheet of Commission Templete 2026.xlsx.

export const COMMISSION_TYPES = ["Sales Overriding", "Introducer", "Location Commission", "Location Overriding"] as const
export const PACKAGE_TYPES = ["Rental", "Installment", "AR", "Cashout"] as const

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

/** Today's date in MYT as "YYYY-MM-DD". */
export function todayMYT(): string {
  return new Date(Date.now() + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Current month in MYT as "YYYY-MM". */
export function currentMonthMYT(): string {
  return todayMYT().slice(0, 7)
}

export const isDateStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
export const isMonthStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** "2026-05" → "MAY 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase() + " " + y
}

const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 0, ADMIN: 1, TEAM_LEADER: 2, SALESPERSON: 3 }

/**
 * Ordering for people lists: the viewer first, then by team ("No team" last), and inside a
 * team the manager on top, then team leaders, then salespeople, then by name.
 */
export function comparePeople(
  a: { id: string; name: string; role: string; team: string | null },
  b: { id: string; name: string; role: string; team: string | null },
  meId: string
): number {
  if (a.id === meId) return -1
  if (b.id === meId) return 1
  // Super Admin always sits on top of every list/report
  const sa = Number(b.role === "SUPER_ADMIN") - Number(a.role === "SUPER_ADMIN")
  if (sa) return sa
  if (a.team !== b.team) {
    if (a.team === null) return 1
    if (b.team === null) return -1
    return a.team.localeCompare(b.team)
  }
  return (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.name.localeCompare(b.name)
}

export type CommissionKindStr = "MA" | "LA"

export type CommissionRow = {
  id: string
  kind: CommissionKindStr
  userId: string
  month: string
  branch: string | null
  customerName: string
  commissionType: string | null
  packageType: string | null
  machineType: string | null
  poNo: string | null
  poDate: string | null
  sellingPrice: number | null
  totalCollection: number | null
  lastPaymentDate: string | null
  machineCount: number | null
  kpi: number | null
  incentive: number | null
  machinePoNo: string | null
  locationPoNo: string | null
  locationName: string | null
  paymentMadePct: number | null
  amountClaim: number
  updatedAt: string
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// Prisma Decimal/Date → plain JSON-safe row for client components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeClaim(c: any): CommissionRow {
  return {
    id: c.id, kind: c.kind, userId: c.userId, month: c.month,
    branch: c.branch, customerName: c.customerName, commissionType: c.commissionType, packageType: c.packageType,
    machineType: c.machineType, poNo: c.poNo, poDate: c.poDate,
    sellingPrice: num(c.sellingPrice), totalCollection: num(c.totalCollection), lastPaymentDate: c.lastPaymentDate,
    machineCount: c.machineCount, kpi: num(c.kpi), incentive: num(c.incentive),
    machinePoNo: c.machinePoNo, locationPoNo: c.locationPoNo, locationName: c.locationName,
    paymentMadePct: num(c.paymentMadePct), amountClaim: Number(c.amountClaim),
    updatedAt: new Date(c.updatedAt).toISOString(),
  }
}

type ParseResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string }

// Validates/normalises a claim body from the client. Only fields relevant to `kind` are kept.
export function parseClaimBody(kind: CommissionKindStr, body: Record<string, unknown>): ParseResult {
  const text = (k: string) => {
    const v = body[k]
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === "" ? null : s.slice(0, 300)
  }
  const date = (k: string) => {
    const s = text(k)
    return s && isDateStr(s) ? s : null
  }
  const decimal = (k: string): number | null | "bad" => {
    const v = body[k]
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) && Math.abs(n) < 1e10 ? Math.round(n * 100) / 100 : "bad"
  }

  const customerName = text("customerName")
  if (!customerName) return { ok: false, error: "Customer Name is required." }
  const amountClaim = decimal("amountClaim")
  if (amountClaim === null || amountClaim === "bad") return { ok: false, error: "Amount Claim (RM) is required and must be a number." }

  const commissionType = text("commissionType")
  if (commissionType && !(COMMISSION_TYPES as readonly string[]).includes(commissionType)) return { ok: false, error: "Invalid Types of Commission." }
  const packageType = text("packageType")
  if (packageType && !(PACKAGE_TYPES as readonly string[]).includes(packageType)) return { ok: false, error: "Invalid Package Type." }

  const paymentMadePct = decimal("paymentMadePct")
  if (paymentMadePct === "bad") return { ok: false, error: "Payment Made (%) must be a number." }

  const data: Record<string, unknown> = {
    branch: text("branch"), customerName, commissionType, packageType, paymentMadePct, amountClaim,
  }

  if (kind === "MA") {
    const fields = [
      ["sellingPrice", "Selling Price"],
      ["totalCollection", "Total Collection Amount"],
      ["kpi", "KPI"],
      ["incentive", "Incentive"],
    ] as const
    for (const [k, label] of fields) {
      const v = decimal(k)
      if (v === "bad") return { ok: false, error: `${label} must be a number.` }
      data[k] = v
    }
    const mc = decimal("machineCount")
    if (mc === "bad" || (mc !== null && !Number.isInteger(mc))) return { ok: false, error: "No of Machine must be a whole number." }
    Object.assign(data, {
      machineType: text("machineType"), poNo: text("poNo"), poDate: date("poDate"),
      lastPaymentDate: date("lastPaymentDate"), machineCount: mc,
    })
  } else {
    Object.assign(data, {
      machinePoNo: text("machinePoNo"), locationPoNo: text("locationPoNo"), locationName: text("locationName"),
    })
  }
  return { ok: true, data }
}

// Lead sources for appointments entered on Daily Activity. "Other" needs a typed description.
export const APPOINTMENT_SOURCES = ["Facebook / Instagram", "TikTok", "Website", "WhatsApp", "Referral", "Walk-in", "Other"] as const

export type DailyAppointmentRow = { id: string; source: string; sourceOther: string | null; customerName: string | null }

type ApptParse = { ok: true; data: { source: string; sourceOther: string | null; customerName: string | null } } | { ok: false; error: string }

export function parseAppointmentBody(body: Record<string, unknown>): ApptParse {
  const text = (k: string) => {
    const v = body[k]
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === "" ? null : s.slice(0, 200)
  }
  const source = text("source")
  if (!source) return { ok: false, error: "Lead source is required." }
  if (!(APPOINTMENT_SOURCES as readonly string[]).includes(source)) return { ok: false, error: "Invalid lead source." }
  const sourceOther = source === "Other" ? text("sourceOther") : null
  if (source === "Other" && !sourceOther) return { ok: false, error: "Please specify the lead source for \"Other\"." }
  return { ok: true, data: { source, sourceOther, customerName: text("customerName") } }
}

/** "Other" sources show what was typed, e.g. "Other: Roadshow". */
export const sourceLabel = (a: { source: string; sourceOther: string | null }) =>
  a.source === "Other" && a.sourceOther ? `Other: ${a.sourceOther}` : a.source
