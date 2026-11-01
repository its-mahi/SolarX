import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { setupComparisonWorld, teardownComparisonWorld, type ComparisonWorld } from "../../helpers/comparison-world";

let w: ComparisonWorld;
beforeAll(async () => {
  w = await setupComparisonWorld();
});
afterAll(() => teardownComparisonWorld(w));

type ListData = {
  requestId: string;
  requestStatus: string;
  quotes: { quoteId: string; vendor: { companyName: string }; normalized: { price: number }; platformEstimates: { subsidyEstimate: number; netCostEstimate: number } }[];
  counts: { total: number; active: number; withdrawn: number };
};

describe("GET /api/requests/:id/quotes", () => {
  it("owner gets normalized quotes with estimates", async () => {
    const res = await apiFetch<ListData>(`/api/requests/${w.requestId}/quotes`, { token: w.owner.accessToken });
    expect(res.status).toBe(200);
    const d = res.json.data!;
    expect(d.counts).toEqual({ total: 3, active: 3, withdrawn: 0 });
    expect(d.quotes.map((q) => q.normalized.price)).toEqual([165000, 142000, 189000]);
    expect(d.quotes.map((q) => q.platformEstimates.netCostEstimate)).toEqual([87000, 64000, 111000]);
    expect(d.quotes[0].vendor.companyName).toBe("SunRise Test");
  });
  it("anonymous 401", async () => {
    expect((await apiFetch(`/api/requests/${w.requestId}/quotes`)).status).toBe(401);
  });
  it("vendor (even one that quoted) 403", async () => {
    const res = await apiFetch(`/api/requests/${w.requestId}/quotes`, { token: w.vendors[0].accessToken });
    expect(res.status).toBe(403);
    expect(res.json.error?.code).toBe("FORBIDDEN");
  });
  it("other household 404 with no data", async () => {
    const res = await apiFetch(`/api/requests/${w.requestId}/quotes`, { token: w.other.accessToken });
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/165000|SunRise/);
  });
  it("non-uuid id 400 and errors leak nothing technical", async () => {
    const res = await apiFetch(`/api/requests/not-a-uuid/quotes`, { token: w.owner.accessToken });
    expect(res.status).toBe(400);
    expect(res.text).not.toMatch(/select |postgres|stack|supabase/i);
  });
});
