import { describe, expect, it } from "vitest";
import { formatDate, formatInr, formatKw, formatUnits } from "@/lib/format";

describe("format", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatInr(150000)).toBe("₹1,50,000");
    expect(formatInr(0)).toBe("₹0");
  });
  it("formats units and capacity", () => {
    expect(formatUnits(250)).toBe("250 units (kWh)");
    expect(formatKw(3)).toBe("3.0 kW");
    expect(formatKw(null)).toBe("—");
  });
  it("formats dates", () => {
    expect(formatDate("2026-11-01T10:00:00Z")).toBe("1 Nov 2026");
  });
});
