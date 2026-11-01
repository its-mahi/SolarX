// PATCH /api/me (contracts/me-api.md). Needs supabase + `npm run dev`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch, cookieHeaderFrom } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

type Me = { profile: { name: string; phone: string | null }; vendor: { service_radius_km: number; company_name: string } | null };

let household: TestUser;
let other: TestUser;
let vendor: TestUser;

beforeAll(async () => {
  household = await createTestUser({ role: "household", name: "Patch Household" });
  other = await createTestUser({ role: "household", name: "Untouched Household" });
  vendor = await createTestUser({ role: "vendor", vendor: { company_name: "Patch Solar" } });
});

afterAll(async () => {
  await Promise.all([household?.id, other?.id, vendor?.id].map(deleteTestUser));
});

describe("PATCH /api/me", () => {
  it("updates a household's name and phone", async () => {
    const res = await apiFetch<Me>("/api/me", {
      method: "PATCH",
      token: household.accessToken,
      body: { name: "Patched Name", phone: "9876543210" },
    });
    expect(res.status).toBe(200);
    expect(res.json.data?.profile).toMatchObject({ name: "Patched Name", phone: "+919876543210" });
  });

  it("updates a vendor's radius and company name", async () => {
    const res = await apiFetch<Me>("/api/me", {
      method: "PATCH",
      token: vendor.accessToken,
      body: { service_radius_km: 35, company_name: "Patch Solar Pvt" },
    });
    expect(res.status).toBe(200);
    expect(res.json.data?.vendor).toMatchObject({ service_radius_km: 35, company_name: "Patch Solar Pvt" });
    const { data } = await adminClient().from("vendors").select("service_radius_km").eq("user_id", vendor.id).single();
    expect(data?.service_radius_km).toBe(35);
  });

  it("rejects vendor fields from a household", async () => {
    const res = await apiFetch("/api/me", { method: "PATCH", token: household.accessToken, body: { company_name: "X Co" } });
    expect(res.status).toBe(400);
  });

  it.each([{ role: "vendor" }, { verification_status: "demo" }])("rejects protected key %o", async (body) => {
    const res = await apiFetch("/api/me", { method: "PATCH", token: vendor.accessToken, body });
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("VALIDATION_FAILED");
  });

  it("returns 401 without a session", async () => {
    const res = await apiFetch("/api/me", { method: "PATCH", body: { name: "Nobody" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a cookie-authenticated request from a foreign origin", async () => {
    const signIn = await apiFetch("/api/auth/demo", { body: { account: "household" } });
    expect(signIn.status).toBe(200);
    const res = await apiFetch("/api/me", {
      method: "PATCH",
      cookie: cookieHeaderFrom(signIn.headers),
      origin: "https://evil.example",
      body: { name: "Evil" },
    });
    expect(res.status).toBe(403);
    expect(res.json.error?.code).toBe("FORBIDDEN");
    const { data } = await adminClient().from("profiles").select("name").eq("id", "d0000000-0000-4000-8000-000000000001").single();
    expect(data?.name).toBe("Sharma Residence");
  });

  it("never changes another user's rows", async () => {
    await apiFetch("/api/me", { method: "PATCH", token: household.accessToken, body: { name: "Only Me" } });
    const { data } = await adminClient().from("profiles").select("name").eq("id", other.id).single();
    expect(data?.name).toBe("Untouched Household");
  });
});
