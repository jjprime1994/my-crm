// Shared constants/helpers for the commission (MA / LA) and daily activity features.
// Dropdown values come from the "Code" sheet of Commission Templete 2026.xlsx.

export const COMMISSION_TYPES = ["Sales Commission", "Sales Overriding", "Introducer", "Location Commission", "Location Overriding"] as const
/** Types offered on each page (owner, 23 Nov 2026): sales types on MA, location types on LA. */
export const COMMISSION_TYPES_BY_KIND: Record<"MA" | "LA", readonly string[]> = {
  MA: ["Sales Commission", "Sales Overriding", "Introducer"],
  LA: ["Location Commission", "Location Overriding", "Introducer"],
}
/** "Commission" type on each page → the "Overriding" type its leader's auto copy gets. */
export const OVERRIDING_FOR: Record<"MA" | "LA", { from: string; to: string }> = {
  MA: { from: "Sales Commission", to: "Sales Overriding" },
  LA: { from: "Location Commission", to: "Location Overriding" },
}
const OVERRIDING_TYPES = new Set(["Sales Overriding", "Location Overriding"])
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

/** Rows inside one person's block: Sales/Location Overriding always at the bottom, otherwise keep entry order. */
export function overridingLast<T extends { commissionType: string | null }>(rows: T[]): T[] {
  const isOv = (r: T) => (r.commissionType && OVERRIDING_TYPES.has(r.commissionType) ? 1 : 0)
  return rows.map((r, i) => ({ r, i })).sort((a, b) => isOv(a.r) - isOv(b.r) || a.i - b.i).map((x) => x.r)
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
  /** null = not keyed in yet (auto Sales Overriding copy) */
  amountClaim: number | null
  /** set on an auto Sales Overriding copy: the Sales Commission row it was copied from */
  sourceClaimId: string | null
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
    paymentMadePct: num(c.paymentMadePct), amountClaim: num(c.amountClaim), sourceClaimId: c.sourceClaimId ?? null,
    updatedAt: new Date(c.updatedAt).toISOString(),
  }
}

type ParseResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string }

// Validates/normalises a claim body from the client. Only fields relevant to `kind` are kept.
// allowBlankAmount: auto overriding copies may stay without an amount until the leader fills it in.
// currentType: the row's existing type, still accepted on edit even if no longer offered on this page.
export function parseClaimBody(kind: CommissionKindStr, body: Record<string, unknown>, allowBlankAmount = false, currentType: string | null = null): ParseResult {
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
  if (amountClaim === "bad" || (amountClaim === null && !allowBlankAmount)) return { ok: false, error: "Amount Claim (RM) is required and must be a number." }

  const commissionType = text("commissionType")
  if (commissionType && !COMMISSION_TYPES_BY_KIND[kind].includes(commissionType) && commissionType !== currentType) return { ok: false, error: "Invalid Types of Commission." }
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

// Lead sources for appointments entered on Daily Activity. Sources in SOURCE_DETAIL need a typed
// detail (stored in DailyAppointment.sourceOther): the event name for "Event", a description for "Other".
export const APPOINTMENT_SOURCES = ["Facebook / Instagram", "TikTok", "Website", "WhatsApp", "Referral", "Walk-in", "Event", "Other"] as const
export const SOURCE_DETAIL: Record<string, { label: string; placeholder: string; error: string }> = {
  Event: { label: "Event name", placeholder: "e.g. MIHAS 2026", error: "Please enter the event name." },
  Other: { label: "Specify source", placeholder: "e.g. Roadshow", error: 'Please specify the lead source for "Other".' },
}

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
  const detail = SOURCE_DETAIL[source]
  const sourceOther = detail ? text("sourceOther") : null
  if (detail && !sourceOther) return { ok: false, error: detail.error }
  return { ok: true, data: { source, sourceOther, customerName: text("customerName") } }
}

/** Sources with a detail show it, e.g. "Event: MIHAS 2026", "Other: Roadshow". */
export const sourceLabel = (a: { source: string; sourceOther: string | null }) =>
  SOURCE_DETAIL[a.source] && a.sourceOther ? `${a.source}: ${a.sourceOther}` : a.source
