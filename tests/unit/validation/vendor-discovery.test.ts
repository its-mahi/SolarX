import { describe, expect, it } from "vitest";
import { vendorRequestFiltersSchema as schema, requestIdParamSchema } from "@/lib/validation/vendor-discovery";

const ok = (input: Record<string, string>) => schema.safeParse(input);

describe("vendorRequestFiltersSchema", () => {
  it("accepts an empty query", () => {
    expect(ok({}).success).toBe(true);
  });

  it("max_distance_km accepts 0 < x <= 500 and 'any'", () => {
    for (const v of ["0.5", "25", "500", "any"]) expect(ok({ max_distance_km: v }).success).toBe(true);
    expect(ok({ max_distance_km: "25" }).data?.max_distance_km).toBe(25);
    expect(ok({ max_distance_km: "any" }).data?.max_distance_km).toBe("any");
  });

  it("max_distance_km rejects 0, -1, 501 and text", () => {
    for (const v of ["0", "-1", "501", "abc"]) {
      const r = ok({ max_distance_km: v });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toEqual(["max_distance_km"]);
    }
  });

  it("locality is trimmed and 1-100 chars", () => {
    expect(ok({ locality: "  Kondapur " }).data?.locality).toBe("Kondapur");
    expect(ok({ locality: "x".repeat(100) }).success).toBe(true);
    expect(ok({ locality: "x".repeat(101) }).success).toBe(false);
    expect(ok({ locality: "   " }).data?.locality).toBeUndefined();
  });

  it("capacity is 0..100 and min <= max", () => {
    expect(ok({ min_capacity_kw: "0", max_capacity_kw: "100" }).success).toBe(true);
    expect(ok({ min_capacity_kw: "-1" }).success).toBe(false);
    expect(ok({ max_capacity_kw: "100.5" }).success).toBe(false);
    expect(ok({ min_capacity_kw: "abc" }).error?.issues[0].path).toEqual(["min_capacity_kw"]);
    const r = ok({ min_capacity_kw: "5", max_capacity_kw: "3" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["min_capacity_kw"]);
  });

  it("budget is an integer 0..10,000,000 and min <= max", () => {
    expect(ok({ min_budget: "0", max_budget: "10000000" }).success).toBe(true);
    expect(ok({ min_budget: "1.5" }).success).toBe(false);
    expect(ok({ max_budget: "10000001" }).success).toBe(false);
    const r = ok({ min_budget: "200000", max_budget: "100000" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["min_budget"]);
  });

  it("sort is distance or newest", () => {
    expect(ok({ sort: "distance" }).success).toBe(true);
    expect(ok({ sort: "newest" }).success).toBe(true);
    expect(ok({ sort: "oldest" }).error?.issues[0].path).toEqual(["sort"]);
  });
});

describe("requestIdParamSchema", () => {
  it("requires a uuid", () => {
    expect(requestIdParamSchema.safeParse("nope").success).toBe(false);
    expect(requestIdParamSchema.safeParse("6f1c2b3a-1111-4222-8333-444455556666").success).toBe(true);
  });
});
