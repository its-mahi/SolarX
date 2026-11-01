// GET /api/quotes/mine and vendor_quoted_request_summaries (specs/005 T021).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";

let hh: TestUser, v1: TestUser, v2: TestUser, v3: TestUser;
let r1: string, r2: string, r3: string;
const ids: Record<string, string> = {};

type Item = { id: string; status: string; request_id: string; request: { id: string; locality: string; status: string } };
const mine = (user: TestUser | null, qs = "") => apiFetch<{ items: Item[] }>(`/api/quotes/mine${qs}`, { token: user?.accessToken });

beforeAll(async () => {
  [hh, v1, v2, v3] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  [r1, r2, r3] = [
    await createRequestWithStatus(hh.id, "quoted"),
    await createRequestWithStatus(hh.id, "quoted"),
    await createRequestWithStatus(hh.id, "accepted"),
  ];
  const vid = async (u: TestUser) => (await adminClient().from("vendors").select("id").eq("user_id", u.id).single()).data!.id;
  const v1id = await vid(v1);
  const v2id = await vid(v2);
  const base = { price: 150000, capacity_kw: 3, installation_days: 14 };
  const ins = async (key: string, request_id: string, vendor_id: string, status: string, offset: number) => {
    const { data, error } = await adminClient()
      .from("quotes")
      .insert({ ...base, request_id, vendor_id, status, created_at: new Date(Date.now() - offset * 60000).toISOString() })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids[key] = data!.id;
  };
  await ins("submitted", r1, v1id, "submitted", 1);
  await ins("withdrawn", r2, v1id, "withdrawn", 2);
  await ins("rejected", r3, v1id, "rejected", 3);
  await ins("other", r1, v2id, "submitted", 1);
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().in("id", [r1, r2, r3]);
  for (const u of [hh, v1, v2, v3]) await deleteTestUser(u?.id);
});

describe("GET /api/quotes/mine", () => {
  it("returns own quotes newest first with request summaries", async () => {
    const r = await mine(v1);
    expect(r.status).toBe(200);
    const items = r.json.data!.items;
    expect(items.map((i) => i.id)).toEqual([ids.submitted, ids.withdrawn, ids.rejected]);
    expect(items[0].request).toEqual({ id: r1, locality: "Test Locality", status: "quoted" });
    expect(items[2].request.status).toBe("accepted");
    expect(r.text).not.toContain("vendor_id");
  });

  it("filters by status and request_id", async () => {
    expect((await mine(v1, "?status=withdrawn")).json.data!.items.map((i) => i.id)).toEqual([ids.withdrawn]);
    expect((await mine(v1, `?request_id=${r3}`)).json.data!.items.map((i) => i.id)).toEqual([ids.rejected]);
  });

  it("never includes other vendors' quotes; empty list for none", async () => {
    expect((await mine(v2)).json.data!.items.map((i) => i.id)).toEqual([ids.other]);
    expect((await mine(v3)).json.data!.items).toEqual([]);
  });

  it("enforces role, session and query validation", async () => {
    expect((await mine(hh)).status).toBe(403);
    expect((await mine(null)).status).toBe(401);
    expect((await mine(v1, "?status=bogus")).status).toBe(400);
  });

  it("summaries rpc returns only request_id, locality, request_status for quoted requests", async () => {
    const r = await v2.client.rpc("vendor_quoted_request_summaries");
    expect(r.error).toBeNull();
    expect(r.data).toEqual([{ request_id: r1, locality: "Test Locality", request_status: "quoted" }]);
  });
});
