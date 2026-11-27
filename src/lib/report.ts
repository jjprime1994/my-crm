// Sales & Location Report (Sales and Location Report 2026.xlsx): each person keys in, per month,
// the sales they closed and the locations they handed over / opened.

export type ReportKindStr = "SALES" | "LOCATION"

/** Common package types from the template, offered as suggestions (free text is still allowed). */
export const REPORT_PACKAGE_SUGGESTIONS = ["AR3i", "ARTT", "Cashout", "Rental", "Rental TT", "JuiceSup", "Recon", "Installment", "Helmet", "Table Top", "Famous Amos", "Big Onion", "Fresh Hub"] as const
/** Location "Type" dropdown (values used in the template). */
export const LOCATION_TYPES = ["Handover", "New Location", "Relocate"] as const

export type ReportRow = {
  id: string
  kind: ReportKindStr
  userId: string
  month: string
  customerName: string
  sellingPrice: number | null
  collection: number | null
  packageType: string | null
  locationDescription: string | null
  locationType: string | null
  updatedAt: string
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeReport(r: any): ReportRow {
  return {
    id: r.id, kind: r.kind, userId: r.userId, month: r.month, customerName: r.customerName,
    sellingPrice: num(r.sellingPrice), collection: num(r.collection), packageType: r.packageType ?? null,
    locationDescription: r.locationDescription ?? null, locationType: r.locationType ?? null,
    updatedAt: new Date(r.updatedAt).toISOString(),
  }
}

/** Collection (%) = collection ÷ selling price, as a 0–100 number rounded to 1 dp; null when it can't be worked out. */
export function collectionPct(r: { sellingPrice: number | null; collection: number | null }): number | null {
  if (r.sellingPrice === null || r.collection === null || r.sellingPrice <= 0) return null
  return Math.round((r.collection / r.sellingPrice) * 1000) / 10
}

type ParseResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string }

// Validates/normalises a report row from the client. Only the fields for `kind` are kept.
// currentType: the row's existing location type, still accepted on edit even if no longer offered.
export function parseReportBody(kind: ReportKindStr, body: Record<string, unknown>, currentType: string | null = null): ParseResult {
  const text = (k: string, max = 300) => {
    const v = body[k]
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === "" ? null : s.slice(0, max)
  }
  const decimal = (k: string): number | null | "bad" => {
    const v = body[k]
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : "bad"
  }

  const customerName = text("customerName")
  if (!customerName) return { ok: false, error: "Customer is required." }

  if (kind === "SALES") {
    const sellingPrice = decimal("sellingPrice")
    if (sellingPrice === "bad") return { ok: false, error: "Selling Price must be a number." }
    const collection = decimal("collection")
    if (collection === "bad") return { ok: false, error: "Collection (RM) must be a number." }
    return { ok: true, data: { customerName, sellingPrice, collection, packageType: text("packageType", 100) } }
  }

  const locationType = text("locationType")
  if (locationType && !(LOCATION_TYPES as readonly string[]).includes(locationType) && locationType !== currentType) return { ok: false, error: "Invalid Type." }
  return { ok: true, data: { customerName, locationDescription: text("locationDescription"), locationType } }
}
