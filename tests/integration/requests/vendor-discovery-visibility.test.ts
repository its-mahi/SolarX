// Visibility and authorization of vendor discovery (004 FR-001, FR-007, FR-010, FR-012, FR-023).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { setupDiscoveryWorld, teardownDiscoveryWorld, type DiscoveryWorld } from "../../helpers/discovery-setup";
import { anonClient } from "../../helpers/supabase";
import { DISCOVERY_FIXTURES } from "../../fixtures/discovery-requests";

let w: DiscoveryWorld;
beforeAll(async () => { w = await setupDiscoveryWorld(); }, 60_000);
afterAll(async () => { await teardownDiscoveryWorld(w); });

const fixtureIds = () => new Set(Object.values(w.ids));

describe("list visibility", () => {
  it("shows only open/quoted fixtures", async () => {
    const res = await apiFetch<{ items: { id: string }[] }>("/api/requests?max_distance_km=any", { token: w.vendor.accessToken });
    const mine = res.json.data!.items.map((i) => i.id).filter((id) => fixtureIds().has(id)).sort();
    const expected = DISCOVERY_FIXTURES.filter((f) => f.visible).map((f) => w.ids[f.key]).sort();
    expect(mine).toEqual(expected);
  });

  it("vendors cannot read household_requests directly", async () => {
    expect((await w.vendor.client.from("household_requests").select("*")).data).toEqual([]);
  });

  it("households and anon cannot call the vendor functions", async () => {
    const h = await w.household.client.rpc("vendor_list_open_requests");
    expect(h.error?.code).toBe("42501");
    expect((await w.household.client.rpc("vendor_get_open_request", { p_request_id: w.ids.kondapur })).error?.code).toBe("42501");
    expect((await anonClient().rpc("vendor_list_open_requests")).error).not.toBeNull();
  });

  it("household GET /api/requests returns only its own requests", async () => {
    const res = await apiFetch<{ items: { id: string }[] }>("/api/requests", { token: w.household.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.data!.items.map((i) => i.id).sort()).toEqual(Object.values(w.ids).sort());
    const other = await apiFetch<{ items: { id: string }[] }>("/api/requests", { token: w.vendorNoBase.accessToken });
    expect(other.status).toBe(200);
  });

  it("rejects unauthenticated callers", async () => {
    const res = await apiFetch("/api/requests");
    expect(res.status).toBe(401);
    expect(res.json.error?.code).toBe("UNAUTHENTICATED");
  });
});

describe("detail visibility", () => {
  it("returns identical 404s for draft, accepted, closed and unknown ids", async () => {
    const bodies: string[] = [];
    for (const id of [w.ids.draft, w.ids.accepted, w.ids.closed, "11111111-1111-4111-8111-111111111111"]) {
      const res = await apiFetch(`/api/requests/${id}`, { token: w.vendor.accessToken });
      expect(res.status).toBe(404);
      expect(res.json.error?.code).toBe("NOT_FOUND");
      bodies.push(res.text);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("rejects a malformed id with 400", async () => {
    const res = await apiFetch("/api/requests/not-a-uuid", { token: w.vendor.accessToken });
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("VALIDATION_FAILED");
  });

  it("signs the photo for at most 600 s and denies direct storage access", async () => {
    const res = await apiFetch<{ roof_photo: { url: string; expires_at: string } }>(`/api/requests/${w.ids.gachibowli}`, { token: w.vendor.accessToken });
    expect(res.status).toBe(200);
    // gachibowli has a stored path but no uploaded object: signing may succeed or be unavailable, never an error
    const k = await apiFetch<{ roof_photo: { url: string; expires_at: string }; roof_photo_status: string }>(`/api/requests/${w.ids.kondapur}`, { token: w.vendor.accessToken });
    expect(Date.parse(k.json.data!.roof_photo.expires_at)).toBeLessThanOrEqual(Date.now() + 600_000 + 2000);
    expect((await fetch(k.json.data!.roof_photo.url)).status).toBe(200);

    const dl = await w.vendor.client.storage.from("roof-photos").download(w.photoPath);
    expect(dl.error).not.toBeNull();
    const ls = await w.vendor.client.storage.from("roof-photos").list(w.household.id);
    expect(ls.data ?? []).toEqual([]);
  });

  it("household callers still get their own detail", async () => {
    const res = await apiFetch<{ id: string }>(`/api/requests/${w.ids.draft}`, { token: w.household.accessToken });
    expect(res.status).toBe(200);
  });
});
