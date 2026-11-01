// GET /api/me (contracts/me-api.md). Needs supabase + `npm run dev`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

type Me = {
  profile: { id: string; email: string; role: string };
  vendor: { company_name: string } | null;
  home_path: string;
};

let household: TestUser;
let vendor: TestUser;
let orphan: TestUser;

beforeAll(async () => {
  household = await createTestUser({ role: "household" });
  vendor = await createTestUser({ role: "vendor", vendor: { company_name: "Me Test Solar" } });
  orphan = await createTestUser({ role: "household" });
  await adminClient().from("profiles").delete().eq("id", orphan.id);
});

afterAll(async () => {
  await Promise.all([household?.id, vendor?.id, orphan?.id].map(deleteTestUser));
});

describe("GET /api/me", () => {
  it("returns 401 UNAUTHENTICATED without a token", async () => {
    const res = await apiFetch("/api/me");
    expect(res.status).toBe(401);
    expect(res.json.error?.code).toBe("UNAUTHENTICATED");
    expect(res.json.error?.details).toEqual([]);
  });

  it("returns the household's own profile and no vendor", async () => {
    const res = await apiFetch<Me>("/api/me", { token: household.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.data?.profile).toMatchObject({ id: household.id, email: household.email, role: "household" });
    expect(res.json.data?.vendor).toBeNull();
    expect(res.json.data?.home_path).toBe("/household");
  });

  it("returns the vendor's own vendor row", async () => {
    const res = await apiFetch<Me>("/api/me", { token: vendor.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.data?.vendor?.company_name).toBe("Me Test Solar");
    expect(res.json.data?.home_path).toBe("/vendor");
  });

  it("returns 401 when the account has no profile row", async () => {
    const res = await apiFetch("/api/me", { token: orphan.accessToken });
    expect(res.status).toBe(401);
  });
});
