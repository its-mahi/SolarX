import { describe, expect, it } from "vitest";
import {
  annotateDistance,
  applyDiscoveryFilters,
  haversineKm,
  resolveDistanceFilter,
  sortDiscoveryResults,
  type RawDiscoveryRequest,
} from "@/lib/domain/requests/discovery";
import type { VendorDiscoveryContext, VendorRequestSummary } from "@/lib/validation/vendor-discovery";
import { DISCOVERY_FIXTURES, VENDOR_BASE } from "../../../fixtures/discovery-requests";

const ctx: VendorDiscoveryContext = {
  service_area: "Hyderabad", base_latitude: VENDOR_BASE.latitude, base_longitude: VENDOR_BASE.longitude,
  service_radius_km: VENDOR_BASE.service_radius_km,
};
const noBase: VendorDiscoveryContext = { service_area: "X", base_latitude: null, base_longitude: null, service_radius_km: null };

const raw = (f: (typeof DISCOVERY_FIXTURES)[number], i: number): RawDiscoveryRequest => ({
  id: f.key, status: f.status as "open" | "quoted", locality: f.locality,
  approx_latitude: f.approx.latitude, approx_longitude: f.approx.longitude,
  monthly_units: f.monthly_units, budget: f.budget, preferred_capacity_kw: f.preferred_capacity_kw,
  has_roof_photo: true, is_demo: true, created_at: new Date(Date.UTC(2026, 10, 1, 10, 0, 0) - i * 60_000).toISOString(),
});
const visible = DISCOVERY_FIXTURES.filter((f) => f.visible);
const annotated = visible.map((f, i) => annotateDistance(raw(f, i), ctx));
const ids = (xs: VendorRequestSummary[]) => xs.map((x) => x.id).sort();

describe("haversineKm", () => {
  it("is 0 for identical points", () => expect(haversineKm(17.44, 78.38, 17.44, 78.38)).toBe(0));
  it("matches Hyderabad reference pairs", () => {
    expect(haversineKm(17.44, 78.38, 17.44, 78.5)).toBeCloseTo(12.73, 0);
    expect(Math.abs(haversineKm(17.385, 78.4867, 17.4401, 78.3489) - 15.4)).toBeLessThan(0.5);
  });
});

describe("annotateDistance", () => {
  it("gives integer km matching the fixtures", () => {
    for (const a of annotated) {
      const f = visible.find((v) => v.key === a.id)!;
      expect(a.distance_km).toBe(f.expectedDistanceKm);
    }
  });
  it("is inclusive at exactly the radius", () => {
    const base = { ...ctx, base_latitude: 0, base_longitude: 0, service_radius_km: haversineKm(0, 0, 0, 0.1) };
    const item = { ...raw(visible[0], 0), approx_latitude: 0, approx_longitude: 0.1 };
    expect(annotateDistance(item, base).within_service_area).toBe(true);
    expect(annotateDistance(item, { ...base, service_radius_km: base.service_radius_km - 0.01 }).within_service_area).toBe(false);
  });
  it("returns nulls when the vendor base is missing", () => {
    const a = annotateDistance(raw(visible[0], 0), noBase);
    expect(a.distance_km).toBeNull();
    expect(a.within_service_area).toBeNull();
    expect(annotateDistance(raw(visible[0], 0), null).distance_km).toBeNull();
  });
});

describe("sortDiscoveryResults", () => {
  it("distance ascending, nulls last, ties newest first", () => {
    const items = [
      { id: "a", distance_km: 5, created_at: "2026-11-01T10:00:00Z" },
      { id: "b", distance_km: null, created_at: "2026-11-01T12:00:00Z" },
      { id: "c", distance_km: 5, created_at: "2026-11-01T11:00:00Z" },
      { id: "d", distance_km: 2, created_at: "2026-11-01T09:00:00Z" },
    ];
    expect(sortDiscoveryResults(items, "distance").map((i) => i.id)).toEqual(["d", "c", "a", "b"]);
  });
  it("newest by created_at desc", () => {
    const items = [
      { id: "a", distance_km: 1, created_at: "2026-11-01T10:00:00Z" },
      { id: "b", distance_km: 9, created_at: "2026-11-01T12:00:00Z" },
    ];
    expect(sortDiscoveryResults(items, "newest").map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("resolveDistanceFilter", () => {
  it("uses explicit values, any disables, absent defaults to radius", () => {
    expect(resolveDistanceFilter(10, ctx)).toBe(10);
    expect(resolveDistanceFilter("any", ctx)).toBeNull();
    expect(resolveDistanceFilter(undefined, ctx)).toBe(25);
  });
  it("is ignored without a base", () => {
    expect(resolveDistanceFilter(10, noBase)).toBeNull();
    expect(resolveDistanceFilter(undefined, null)).toBeNull();
  });
});

describe("applyDiscoveryFilters", () => {
  it("applies the distance cap inclusively", () => {
    expect(ids(applyDiscoveryFilters(annotated, {}, 25))).toEqual(["gachibowli", "kondapur", "nolocality", "secunderabad"]);
    expect(ids(applyDiscoveryFilters(annotated, {}, 3))).toEqual(["gachibowli", "kondapur"]);
    expect(applyDiscoveryFilters(annotated, {}, null)).toHaveLength(5);
  });
  it("capacity bounds are inclusive and exclude null only when set", () => {
    expect(ids(applyDiscoveryFilters(annotated, { min_capacity_kw: 3, max_capacity_kw: 5 }, null))).toEqual(["gachibowli", "kondapur"]);
    expect(applyDiscoveryFilters(annotated, {}, null).map((i) => i.id)).toContain("secunderabad");
    expect(ids(applyDiscoveryFilters(annotated, { max_capacity_kw: 2 }, null))).toEqual(["nolocality"]);
  });
  it("budget bounds are inclusive", () => {
    expect(ids(applyDiscoveryFilters(annotated, { min_budget: 100000, max_budget: 200000 }, null))).toEqual(["gachibowli", "kondapur", "nolocality"]);
  });
  it("locality is case-insensitive contains; null never matches", () => {
    expect(ids(applyDiscoveryFilters(annotated, { locality: "HYDERABAD" }, null))).toEqual(["gachibowli", "kondapur"]);
    expect(ids(applyDiscoveryFilters(annotated, { locality: "secunder" }, null))).toEqual(["secunderabad"]);
  });
  it("null locality never matches a locality filter", () => {
    const withNull = [{ ...annotated[0], id: "nullloc", locality: null }];
    expect(applyDiscoveryFilters(withNull, { locality: "a" }, null)).toEqual([]);
    expect(applyDiscoveryFilters(withNull, {}, null)).toHaveLength(1);
  });
  it("combines filters with AND", () => {
    expect(ids(applyDiscoveryFilters(annotated, { locality: "hyderabad", min_budget: 180000 }, 25))).toEqual(["gachibowli"]);
  });
});
