// solar_estimates RLS: owner reads; everyone else reads nothing; browsers can never write.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

let owner: TestUser;
let other: TestUser;
let vendor: TestUser;
let requestId: string;

beforeAll(async () => {
  [owner, other, vendor] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
  ]);
  const r = await owner.client.from("household_requests").insert({ user_id: owner.id }).select().single();
  requestId = r.data!.id;
  const ins = await adminClient().from("solar_estimates").insert({
    request_id: requestId, capacity_kw: 3, installation_cost: 180000, subsidy_estimate: 78000, net_cost: 102000,
    annual_generation_kwh: 4200, annual_savings_estimate: 24360, payback_years: 4.2, rule_version: "pm-surya-ghar.v1",
  });
  expect(ins.error).toBeNull();
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().in("user_id", [owner?.id, other?.id].filter(Boolean));
  for (const u of [owner, other, vendor]) await deleteTestUser(u?.id);
});

describe("solar_estimates RLS", () => {
  it("lets the owner read their estimate", async () => {
    const { data } = await owner.client.from("solar_estimates").select().eq("request_id", requestId);
    expect(data).toHaveLength(1);
  });

  it("hides it from other households, vendors and anonymous users", async () => {
    expect((await other.client.from("solar_estimates").select()).data).toEqual([]);
    expect((await vendor.client.from("solar_estimates").select()).data).toEqual([]);
    expect((await anonClient().from("solar_estimates").select()).data ?? []).toEqual([]);
  });

  it("denies browser insert, update and delete, even for the owner", async () => {
    const ins = await owner.client.from("solar_estimates").insert({
      request_id: requestId, capacity_kw: 1, installation_cost: 1, subsidy_estimate: 1, net_cost: 1,
      annual_generation_kwh: 1, annual_savings_estimate: 1, rule_version: "x",
    });
    expect(ins.error).not.toBeNull();
    const upd = await owner.client.from("solar_estimates").update({ subsidy_estimate: 999999 }).eq("request_id", requestId).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await owner.client.from("solar_estimates").delete().eq("request_id", requestId).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await adminClient().from("solar_estimates").select().eq("request_id", requestId).single();
    expect(data?.subsidy_estimate).toBe(78000);
  });
});
