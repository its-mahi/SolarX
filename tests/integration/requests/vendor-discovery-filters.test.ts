// Filter correctness through GET /api/requests as a vendor (004 FR-014..FR-017).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { setupDiscoveryWorld, teardownDiscoveryWorld, type DiscoveryWorld } from "../../helpers/discovery-setup";

let w: DiscoveryWorld;
beforeAll(async () => { w = await setupDiscoveryWorld(); }, 60_000);
afterAll(async () => { await teardownDiscoveryWorld(w); });

type List = { items: { id: string; distance_km: number | null }[]; applied_filters: Record<string, unknown> };
async function keys(query: string, token = () => w.vendor.accessToken) {
  const res = await apiFetch<List>(`/api/requests${query}`, { token: token() });
  expect(res.status).toBe(200);
  const rev = Object.fromEntries(Object.entries(w.ids).map(([k, v]) => [v, k]));
  return { keys: res.json.data!.items.filter((i) => rev[i.id]).map((i) => rev[i.id]).sort(), res: res.json.data! };
}

describe("filters", () => {
  it("defaults to the service radius and echoes it", async () => {
    const r = await keys("");
    expect(r.keys).toEqual(["gachibowli", "kondapur", "nolocality", "secunderabad"]);
    expect(r.res.applied_filters.max_distance_km).toBe(25);
  });
  it("max_distance_km=any returns everything visible", async () => {
    expect((await keys("?max_distance_km=any")).keys).toEqual(["gachibowli", "kondapur", "nolocality", "outside", "secunderabad"]);
  });
  it("distance filter", async () => {
    expect((await keys("?max_distance_km=5")).keys).toEqual(["gachibowli", "kondapur"]);
  });
  it("capacity filter", async () => {
    expect((await keys("?max_distance_km=any&min_capacity_kw=3&max_capacity_kw=5")).keys).toEqual(["gachibowli", "kondapur"]);
  });
  it("budget filter", async () => {
    expect((await keys("?max_distance_km=any&min_budget=100000&max_budget=200000")).keys).toEqual(["gachibowli", "kondapur", "nolocality"]);
  });
  it("locality filter", async () => {
    expect((await keys("?max_distance_km=any&locality=hyderabad")).keys).toEqual(["gachibowli", "kondapur"]);
  });
  it("combination", async () => {
    expect((await keys("?locality=hyderabad&min_budget=180000")).keys).toEqual(["gachibowli"]);
    expect((await keys("?max_distance_km=any&min_capacity_kw=5&max_budget=250000")).keys).toEqual(["gachibowli", "outside"]);
  });
  it("sorts by distance ascending by default", async () => {
    const { res } = await keys("");
    const d = res.items.map((i) => i.distance_km).filter((x): x is number => x !== null);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
  it("rejects invalid inputs with field paths", async () => {
    for (const [q, path] of [["min_budget=200000&max_budget=100000", "min_budget"], ["max_distance_km=-1", "max_distance_km"], ["min_capacity_kw=abc", "min_capacity_kw"]]) {
      const res = await apiFetch(`/api/requests?${q}`, { token: w.vendor.accessToken });
      expect(res.status).toBe(400);
      expect(res.json.error?.code).toBe("VALIDATION_FAILED");
      expect(res.json.error?.details.map((d) => d.path)).toContain(path);
    }
  });
  it("vendor without a base gets null distances and no distance filtering", async () => {
    const r = await keys("?max_distance_km=5", () => w.vendorNoBase.accessToken);
    expect(r.keys).toEqual(["gachibowli", "kondapur", "nolocality", "outside", "secunderabad"]);
    for (const i of r.res.items) expect(i.distance_km).toBeNull();
  });
});
