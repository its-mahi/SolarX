// RLS and guard triggers on profiles/vendors, using direct Supabase clients (no app server needed).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

let householdA: TestUser;
let householdB: TestUser;
let vendor: TestUser;

beforeAll(async () => {
  householdA = await createTestUser({ role: "household", name: "Household A" });
  householdB = await createTestUser({ role: "household", name: "Household B" });
  vendor = await createTestUser({ role: "vendor", name: "Vendor V", vendor: { company_name: "V Solar" } });
});

afterAll(async () => {
  await Promise.all([householdA?.id, householdB?.id, vendor?.id].map(deleteTestUser));
});

describe("profiles", () => {
  it("a user reads only their own profile", async () => {
    const own = await householdA.client.from("profiles").select("id").eq("id", householdA.id);
    expect(own.data).toHaveLength(1);
    const other = await householdA.client.from("profiles").select("id").eq("id", householdB.id);
    expect(other.data).toHaveLength(0);
    const all = await householdA.client.from("profiles").select("id");
    expect(all.data?.map((r) => r.id)).toEqual([householdA.id]);
  });

  it("anonymous users read no profiles", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("a user cannot update another user's profile", async () => {
    const { data } = await householdA.client.from("profiles").update({ name: "Hacked" }).eq("id", householdB.id).select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("a user can update own name but not role or is_demo", async () => {
    const okUpdate = await householdA.client.from("profiles").update({ name: "Household A2" }).eq("id", householdA.id).select("name");
    expect(okUpdate.error).toBeNull();
    expect(okUpdate.data?.[0]?.name).toBe("Household A2");

    const roleChange = await householdA.client.from("profiles").update({ role: "vendor" }).eq("id", householdA.id);
    expect(roleChange.error).not.toBeNull();

    const demoChange = await householdA.client.from("profiles").update({ is_demo: true }).eq("id", householdA.id);
    expect(demoChange.error).not.toBeNull();
  });

  it("clients cannot insert profiles", async () => {
    const { error } = await householdA.client
      .from("profiles")
      .insert({ id: householdA.id, name: "Dup", role: "household" });
    expect(error).not.toBeNull();
  });
});

describe("vendors", () => {
  it("signed-in households can read vendor business details", async () => {
    const { data } = await householdA.client.from("vendors").select("company_name, service_area").eq("user_id", vendor.id);
    expect(data?.[0]?.company_name).toBe("V Solar");
  });

  it("a household cannot update a vendor row", async () => {
    const { data } = await householdA.client.from("vendors").update({ company_name: "Hijack" }).eq("user_id", vendor.id).select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("a vendor can edit business fields but not verification_status or user_id", async () => {
    const okUpdate = await vendor.client.from("vendors").update({ service_radius_km: 35 }).eq("user_id", vendor.id).select("service_radius_km");
    expect(okUpdate.error).toBeNull();
    expect(okUpdate.data?.[0]?.service_radius_km).toBe(35);

    const verify = await vendor.client.from("vendors").update({ verification_status: "demo" }).eq("user_id", vendor.id);
    expect(verify.error).not.toBeNull();

    const move = await vendor.client.from("vendors").update({ user_id: householdA.id }).eq("user_id", vendor.id);
    expect(move.error).not.toBeNull();
  });

  it("clients cannot insert vendor rows", async () => {
    const { error } = await householdA.client
      .from("vendors")
      .insert({ user_id: householdA.id, company_name: "Fake Co", service_area: "Nowhere" });
    expect(error).not.toBeNull();
  });
});
