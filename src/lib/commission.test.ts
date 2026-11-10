import { describe, expect, it } from "vitest"
import { isMonthStr, monthLabel, parseClaimBody } from "./commission"

describe("parseClaimBody", () => {
  it("requires customer name and amount claim", () => {
    expect(parseClaimBody("MA", { amountClaim: "100" })).toEqual({ ok: false, error: "Customer Name is required." })
    expect(parseClaimBody("MA", { customerName: "ABC" }).ok).toBe(false)
    expect(parseClaimBody("LA", { customerName: "ABC", amountClaim: "abc" }).ok).toBe(false)
  })

  it("keeps branch / machine as free text and incentive as a number (MA)", () => {
    const r = parseClaimBody("MA", {
      customerName: " ABC Sdn Bhd ", amountClaim: "1234.567", branch: "Kuala Lumpur", machineType: "MMAP+ custom",
      incentive: "250", machineCount: "2", commissionType: "Introducer", packageType: "Cashout", poDate: "2026-05-04",
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({
      customerName: "ABC Sdn Bhd", amountClaim: 1234.57, branch: "Kuala Lumpur", machineType: "MMAP+ custom",
      incentive: 250, machineCount: 2, commissionType: "Introducer", packageType: "Cashout", poDate: "2026-05-04",
    })
  })

  it("rejects values outside the dropdown lists and non-integer machine counts", () => {
    expect(parseClaimBody("MA", { customerName: "A", amountClaim: 1, commissionType: "Bonus" }).ok).toBe(false)
    expect(parseClaimBody("MA", { customerName: "A", amountClaim: 1, packageType: "Lease" }).ok).toBe(false)
    expect(parseClaimBody("MA", { customerName: "A", amountClaim: 1, machineCount: "1.5" }).ok).toBe(false)
    expect(parseClaimBody("MA", { customerName: "A", amountClaim: 1, incentive: "N/A" }).ok).toBe(false)
  })

  it("only keeps LA fields for LA claims", () => {
    const r = parseClaimBody("LA", { customerName: "A", amountClaim: 50, locationName: "Mall", sellingPrice: 999, machinePoNo: "PO1" })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.locationName).toBe("Mall")
    expect(r.data.machinePoNo).toBe("PO1")
    expect("sellingPrice" in r.data).toBe(false)
  })
})

describe("month helpers", () => {
  it("validates and labels months", () => {
    expect(isMonthStr("2026-05")).toBe(true)
    expect(isMonthStr("2026-13")).toBe(false)
    expect(monthLabel("2026-05")).toBe("MAY 2026")
  })
})

describe("comparePeople", () => {
  it("puts the viewer first, then the manager on top within each team, No team last", async () => {
    const { comparePeople } = await import("./commission")
    const people = [
      { id: "s1", name: "Stella", role: "SALESPERSON", team: "Jack See" },
      { id: "x", name: "Zed", role: "SALESPERSON", team: null },
      { id: "t1", name: "Tina", role: "TEAM_LEADER", team: "Jack See" },
      { id: "a1", name: "Jack See", role: "ADMIN", team: "Jack See" },
      { id: "a2", name: "Ken Lee", role: "ADMIN", team: "Ken Lee" },
      { id: "me", name: "Johnny", role: "SUPER_ADMIN", team: null },
    ]
    const order = people.slice().sort((a, b) => comparePeople(a, b, "me")).map((p) => p.id)
    expect(order).toEqual(["me", "a1", "t1", "s1", "a2", "x"])
  })

  it("keeps the Super Admin on top even when someone else is viewing", async () => {
    const { comparePeople } = await import("./commission")
    const people = [
      { id: "s1", name: "Stella", role: "SALESPERSON", team: "Jack See" },
      { id: "a1", name: "Jack See", role: "ADMIN", team: "Jack See" },
      { id: "sa", name: "Johnny Liong", role: "SUPER_ADMIN", team: null },
      { id: "a2", name: "Ken Lee", role: "ADMIN", team: "Ken Lee" },
    ]
    const order = people.slice().sort((a, b) => comparePeople(a, b, "a2")).map((p) => p.id)
    expect(order).toEqual(["a2", "sa", "a1", "s1"])
  })
})

describe("parseAppointmentBody", () => {
  it("requires a known lead source", async () => {
    const { parseAppointmentBody } = await import("./commission")
    expect(parseAppointmentBody({}).ok).toBe(false)
    expect(parseAppointmentBody({ source: "Billboard" }).ok).toBe(false)
    expect(parseAppointmentBody({ source: "TikTok", customerName: "  Ali  " })).toEqual({
      ok: true, data: { source: "TikTok", sourceOther: null, customerName: "Ali" },
    })
  })

  it("makes the description compulsory for Other, and drops it for other sources", async () => {
    const { parseAppointmentBody } = await import("./commission")
    expect(parseAppointmentBody({ source: "Other" })).toEqual({ ok: false, error: 'Please specify the lead source for "Other".' })
    expect(parseAppointmentBody({ source: "Other", sourceOther: "   " }).ok).toBe(false)
    expect(parseAppointmentBody({ source: "Other", sourceOther: "Roadshow" })).toMatchObject({ ok: true, data: { sourceOther: "Roadshow" } })
    expect(parseAppointmentBody({ source: "Referral", sourceOther: "ignored" })).toMatchObject({ ok: true, data: { sourceOther: null } })
  })

  it("requires the event name for Event and shows it in the label", async () => {
    const { parseAppointmentBody, sourceLabel } = await import("./commission")
    expect(parseAppointmentBody({ source: "Event" })).toEqual({ ok: false, error: "Please enter the event name." })
    const r = parseAppointmentBody({ source: "Event", sourceOther: " MIHAS 2026 " })
    expect(r).toMatchObject({ ok: true, data: { source: "Event", sourceOther: "MIHAS 2026" } })
    expect(sourceLabel({ source: "Event", sourceOther: "MIHAS 2026" })).toBe("Event: MIHAS 2026")
    expect(sourceLabel({ source: "TikTok", sourceOther: null })).toBe("TikTok")
  })
})
