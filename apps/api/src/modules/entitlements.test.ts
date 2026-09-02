import { canViewNutrition, toEntitlement } from "./entitlements";

describe("entitlement mapping", () => {
  it("grants nutrition only for an active persisted subscription", () => {
    expect(canViewNutrition({ status: "active" })).toBe(true);
    for (const status of ["incomplete", "incomplete_expired", "past_due", "unpaid", "paused", "canceled"]) {
      expect(canViewNutrition({ status })).toBe(false);
    }
    expect(canViewNutrition(null)).toBe(false);
  });

  it("returns a safe public entitlement projection", () => {
    expect(toEntitlement({
      status: "active",
      currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    })).toEqual({
      canViewNutrition: true,
      subscriptionStatus: "active",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    });
    expect(toEntitlement(null)).toEqual({
      canViewNutrition: false,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(toEntitlement({ status: "past_due" })).toEqual({
      canViewNutrition: false,
      subscriptionStatus: "past_due",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });
});
