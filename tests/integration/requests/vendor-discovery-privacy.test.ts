// Privacy of the vendor views (004 FR-005, FR-006, FR-011).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { setupDiscoveryWorld, teardownDiscoveryWorld, type DiscoveryWorld } from "../../helpers/discovery-setup";
import { DISCOVERY_FIXTURES, HOUSEHOLD_NAME, HOUSEHOLD_PHONE } from "../../fixtures/discovery-requests";

let w: DiscoveryWorld;
const FORBIDDEN_KEYS = ["address_text", "latitude", "longitude", "user_id", "name", "phone", "monthly_bill", "ai_consent", "roof_photo_path"];

function collectKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); collectKeys(x, out); }
  return out;
}
function expectNoLeak(serialized: string, parsed: unknown) {
  const keys = collectKeys(parsed);
  for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `key ${k}`).toBe(false);
  for (const f of DISCOVERY_FIXTURES) {
    expect(serialized).not.toContain(String(f.latitude));
    expect(serialized).not.toContain(String(f.longitude));
    expect(serialized).not.toContain(f.address_text);
  }
  expect(serialized).not.toContain(HOUSEHOLD_NAME);
  expect(serialized).not.toContain(HOUSEHOLD_PHONE);
  expect(serialized).not.toContain(w.photoPath);
}
const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

beforeAll(async () => { w = await setupDiscoveryWorld(); }, 60_000);
afterAll(async () => { await teardownDiscoveryWorld(w); });

describe("vendor list privacy", () => {
  it("GET /api/requests exposes only approximate data", async () => {
    const res = await apiFetch<{ items: Record<string, unknown>[] }>("/api/requests?max_distance_km=any", { token: w.vendor.accessToken });
    expect(res.status).toBe(200);
    expectNoLeak(res.text, res.json);
    for (const f of DISCOVERY_FIXTURES.filter((x) => x.visible)) {
      const item = res.json.data!.items.find((i) => i.id === w.ids[f.key])!;
      expect(item.approx_latitude).toBe(f.approx.latitude);
      expect(item.approx_longitude).toBe(f.approx.longitude);
      expect(decimals(item.approx_latitude as number)).toBeLessThanOrEqual(2);
    }
  });

  it("rpc vendor_list_open_requests is equally safe", async () => {
    const { data, error } = await w.vendor.client.rpc("vendor_list_open_requests");
    expect(error).toBeNull();
    expectNoLeak(JSON.stringify(data), data);
    for (const r of data!) {
      expect(decimals(Number(r.approx_latitude))).toBeLessThanOrEqual(2);
      expect(decimals(Number(r.approx_longitude))).toBeLessThanOrEqual(2);
    }
  });
});

describe("vendor detail privacy", () => {
  it("GET /api/requests/:id and the rpc contain no forbidden data", async () => {
    const res = await apiFetch<Record<string, unknown>>(`/api/requests/${w.ids.kondapur}`, { token: w.vendor.accessToken });
    expect(res.status).toBe(200);
    // the signed URL legitimately contains the storage path; check everything else
    const { roof_photo, ...rest } = res.json.data!;
    expectNoLeak(JSON.stringify(rest), rest);
    expect(Object.keys(roof_photo as object).sort()).toEqual(["expires_at", "url"]);
    expect(res.json.data!.roof_photo_status).toBe("available");

    const rpc = await w.vendor.client.rpc("vendor_get_open_request", { p_request_id: w.ids.kondapur });
    expectNoLeak(JSON.stringify(rpc.data), rpc.data);
  });

  it("roof_assessment is null when none is available", async () => {
    const res = await apiFetch<{ roof_assessment: unknown }>(`/api/requests/${w.ids.kondapur}`, { token: w.vendor.accessToken });
    expect(res.json.data!.roof_assessment).toBeNull();
  });
});
