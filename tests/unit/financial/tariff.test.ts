import { describe, expect, it } from "vitest";
import { activeRuleSet as rules } from "@/config/rules";
import { resolveTariff } from "@/lib/domain/financial/tariff";

describe("resolveTariff", () => {
  it("uses the default ₹7.00 when there is no bill", () => {
    expect(resolveTariff({ monthlyUnits: 250, monthlyBill: null }, rules)).toEqual({ tariffPerKwh: 7, tariffBasis: "default" });
    expect(resolveTariff({ monthlyUnits: 250 }, rules).tariffBasis).toBe("default");
  });
  it("derives ₹8.00 from a ₹2,000 bill for 250 units", () => {
    expect(resolveTariff({ monthlyUnits: 250, monthlyBill: 2000 }, rules)).toEqual({
      tariffPerKwh: 8,
      tariffBasis: "derived_from_bill",
    });
  });
  it("clamps a tiny bill up to ₹3.00", () => {
    expect(resolveTariff({ monthlyUnits: 300, monthlyBill: 50 }, rules)).toEqual({
      tariffPerKwh: 3,
      tariffBasis: "derived_from_bill_clamped",
    });
  });
  it("clamps a huge bill down to ₹12.00", () => {
    expect(resolveTariff({ monthlyUnits: 300, monthlyBill: 6000 }, rules)).toEqual({
      tariffPerKwh: 12,
      tariffBasis: "derived_from_bill_clamped",
    });
  });
  it("treats a zero bill as no bill", () => {
    expect(resolveTariff({ monthlyUnits: 250, monthlyBill: 0 }, rules).tariffBasis).toBe("default");
  });
});
