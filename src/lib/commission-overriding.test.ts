import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/app-settings", () => ({ getCommissionBlockedIds: async () => [] }))
import { needsOverridingCopy } from "./commission-overriding"

describe("needsOverridingCopy", () => {
  it("copies MA Sales Commission rows only", () => {
    expect(needsOverridingCopy({ kind: "MA", commissionType: "Sales Commission", sourceClaimId: null })).toBe(true)
    expect(needsOverridingCopy({ kind: "MA", commissionType: "Sales Overriding", sourceClaimId: null })).toBe(false)
    expect(needsOverridingCopy({ kind: "MA", commissionType: "Introducer", sourceClaimId: null })).toBe(false)
    expect(needsOverridingCopy({ kind: "LA", commissionType: "Sales Commission", sourceClaimId: null })).toBe(false)
  })
  it("never copies a copy (one level up only)", () => {
    expect(needsOverridingCopy({ kind: "MA", commissionType: "Sales Commission", sourceClaimId: "src1" })).toBe(false)
  })
})
