// quotes RLS: SELECT-only, own-vendor / own-request-owner visibility (specs/005 T007).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";

let hhA: TestUser, hhB: TestUser, vA: TestUser, vB: TestUser;
let requestId: string;
let quoteA: string, quoteB: string;

async function vendorId(u: TestUser) {
  const { data } = await adminClient().from("vendors").select("id").eq("user_id", u.id).single();
  return data!.id;
}

beforeAll(async () => {
  [hhA, hhB, vA, vB] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  requestId = await createRequestWithStatus(hhA.id, "open");
  const base = { request_id: requestId, price: 150000, capacity_kw: 3, installation_days: 14 };
  const a = await adminClient().from("quotes").insert({ ...base, vendor_id: await vendorId(vA) }).select("id").single();
  const b = await adminClient().from("quotes").insert({ ...base, vendor_id: await vendorId(vB) }).select("id").single();
  expect(a.error).toBeNull();
  quoteA = a.data!.id;
  quoteB = b.data!.id;
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("id", requestId);
  for (const u of [hhA, hhB, vA, vB]) await deleteTestUser(u?.id);
});

describe("quotes RLS", () => {
  it("vendor sees only own quotes", async () => {
    const r = await vA.client.from("quotes").select("id");
    expect(r.data?.map((q) => q.id)).toEqual([quoteA]);
  });

  it("vendor cannot update or delete another vendor's quote", async () => {
    const u = await vB.client.from("quotes").update({ price: 1000 }).eq("id", quoteA).select();
    expect(u.data ?? []).toEqual([]);
    const d = await vB.client.from("quotes").delete().eq("id", quoteA).select();
    expect(d.data ?? []).toEqual([]);
    const { data } = await adminClient().from("quotes").select("price").eq("id", quoteA).single();
    expect(data!.price).toBe(150000);
  });

  it("vendors cannot insert directly or change own price/status", async () => {
    const ins = await vA.client.from("quotes").insert({ request_id: requestId, vendor_id: await vendorId(vA), price: 1000, capacity_kw: 1, installation_days: 1 });
    expect(ins.error).not.toBeNull();
    const up = await vA.client.from("quotes").update({ price: 1000, status: "accepted" }).eq("id", quoteA).select();
    expect(up.data ?? []).toEqual([]);
    const del = await vA.client.from("quotes").delete().eq("id", quoteA).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await adminClient().from("quotes").select("price,status").eq("id", quoteA).single();
    expect(data).toEqual({ price: 150000, status: "submitted" });
  });

  it("household reads quotes only on own request and cannot write", async () => {
    const own = await hhA.client.from("quotes").select("id").eq("request_id", requestId);
    expect(own.data?.map((q) => q.id).sort()).toEqual([quoteA, quoteB].sort());
    expect((await hhB.client.from("quotes").select("id")).data).toEqual([]);
    const up = await hhA.client.from("quotes").update({ status: "accepted" }).eq("id", quoteA).select();
    expect(up.data ?? []).toEqual([]);
    const del = await hhA.client.from("quotes").delete().eq("id", quoteA).select();
    expect(del.data ?? []).toEqual([]);
    const ins = await hhA.client.from("quotes").insert({ request_id: requestId, vendor_id: await vendorId(vA), price: 1000, capacity_kw: 1, installation_days: 1 });
    expect(ins.error).not.toBeNull();
  });

  it("anonymous reads nothing", async () => {
    const r = await anonClient().from("quotes").select("id");
    expect(r.data ?? []).toEqual([]);
  });
});
