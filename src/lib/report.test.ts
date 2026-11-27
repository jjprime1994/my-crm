import { describe, expect, it } from "vitest"
import { collectionPct, parseReportBody } from "./report"

describe("parseReportBody", () => {
  it("requires a customer", () => {
    expect(parseReportBody("SALES", { customerName: "  " })).toEqual({ ok: false, error: "Customer is required." })
  })
  it("keeps only sales fields for SALES", () => {
    const r = parseReportBody("SALES", { customerName: "Ng Kin Siong", sellingPrice: "55888", collection: "44710.4", packageType: "JuiceSup", locationType: "Handover" })
    expect(r).toEqual({ ok: true, data: { customerName: "Ng Kin Siong", sellingPrice: 55888, collection: 44710.4, packageType: "JuiceSup" } })
  })
  it("rejects bad or negative numbers", () => {
    expect(parseReportBody("SALES", { customerName: "A", sellingPrice: "abc" }).ok).toBe(false)
    expect(parseReportBody("SALES", { customerName: "A", collection: "-5" }).ok).toBe(false)
  })
  it("allows free-text package types", () => {
    expect(parseReportBody("SALES", { customerName: "A", packageType: "Santan Frozen Ai" })).toMatchObject({ ok: true, data: { packageType: "Santan Frozen Ai" } })
  })
  it("keeps only location fields for LOCATION and checks the type", () => {
    expect(parseReportBody("LOCATION", { customerName: "B", locationDescription: "Astro, Bukit Jalil", locationType: "Handover", sellingPrice: "1" }))
      .toEqual({ ok: true, data: { customerName: "B", locationDescription: "Astro, Bukit Jalil", locationType: "Handover" } })
    expect(parseReportBody("LOCATION", { customerName: "B", locationType: "Nonsense" }).ok).toBe(false)
    expect(parseReportBody("LOCATION", { customerName: "B", locationType: "Confirmed" }, "Confirmed").ok).toBe(true)
  })
})

describe("collectionPct", () => {
  it("works out collection ÷ selling price", () => {
    expect(collectionPct({ sellingPrice: 55888, collection: 44710.4 })).toBe(80)
    expect(collectionPct({ sellingPrice: 300000, collection: 8400 })).toBe(2.8)
  })
  it("is null when it can't be worked out", () => {
    expect(collectionPct({ sellingPrice: null, collection: 100 })).toBeNull()
    expect(collectionPct({ sellingPrice: 0, collection: 100 })).toBeNull()
  })
})
