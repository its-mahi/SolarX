// POST /api/solar/calculate: save mode (requestId), request preview and inputs preview.
// Needs local supabase + `npm run dev`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

type Calc = { saved: boolean; estimate: { capacityKw: number; subsidyEstimate: number; capacityBasis: string; ruleVersion: string; assumptions: unknown; updatedAt?: string }; disclaimer: string };

let household: TestUser;
let vendor: TestUser;
let other: TestUser;
let requestId: string;
let emptyRequestId: string;

beforeAll(async () => {
  household = await createTestUser({ role: "household" });
  vendor = await createTestUser({ role: "vendor" });
  other = await createTestUser({ role: "household" });
  const r = await household.client.from("household_requests").insert({ user_id: household.id }).select().single();
  requestId = r.data!.id;
  const up = await household.client.from("household_requests").update({ monthly_units: 250, budget: 150000, preferred_capacity_kw: 3 }).eq("id", requestId);
  expect(up.error).toBeNull();
  const e = await household.client.from("household_requests").insert({ user_id: household.id }).select().single();
  emptyRequestId = e.data!.id;
});
afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("user_id", household?.id ?? "");
  await Promise.all([household?.id, vendor?.id, other?.id].map(deleteTestUser));
});

const demoInputs = { monthlyUnits: 250, monthlyBill: null, budget: 150000, preferredCapacityKw: 3 };

describe("POST /api/solar/calculate (inputs preview)", () => {
  it("returns an unsaved estimate with assumptions, version and disclaimer", async () => {
    const res = await apiFetch<Calc>("/api/solar/calculate", { token: household.accessToken, body: { inputs: demoInputs } });
    expect(res.status).toBe(200);
    expect(res.json.data!.saved).toBe(false);
    expect(res.json.data!.estimate).toMatchObject({ capacityKw: 3, subsidyEstimate: 78000, ruleVersion: "pm-surya-ghar.v1" });
    expect(res.json.data!.estimate.updatedAt).toBeUndefined();
    expect(res.json.data!.estimate.assumptions).toBeTruthy();
    expect(res.json.data!.disclaimer).toMatch(/does not guarantee/i);
  });

  it("supports a what-if capacity", async () => {
    const res = await apiFetch<Calc>("/api/solar/calculate", {
      token: household.accessToken,
      body: { inputs: { monthlyUnits: 250 }, capacityOverrideKw: 5 },
    });
    expect(res.status).toBe(200);
    expect(res.json.data!.estimate).toMatchObject({ capacityKw: 5, subsidyEstimate: 78000, capacityBasis: "preview" });
  });

  it("rejects an override outside 1–10 kW with 400", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { inputs: { monthlyUnits: 250 }, capacityOverrideKw: 0.5 } });
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("VALIDATION_FAILED");
  });

  it("returns 401 without a session", async () => {
    const res = await apiFetch("/api/solar/calculate", { body: { inputs: demoInputs } });
    expect(res.status).toBe(401);
    expect(res.json.error?.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a vendor", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: vendor.accessToken, body: { inputs: demoInputs } });
    expect(res.status).toBe(403);
    expect(res.json.error?.code).toBe("FORBIDDEN");
  });

  it("returns 400 with field details for a malformed body", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { inputs: { monthlyUnits: -5 } } });
    expect(res.status).toBe(400);
    expect(res.json.error?.details.map((d) => d.path)).toContain("inputs.monthlyUnits");
  });

  it("never leaks SQL or stack text in an error", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: "{not json" });
    expect(res.status).toBe(400);
    expect(res.text).not.toMatch(/select |stack|at .*\(/i);
  });
});

const storedRows = async () => (await adminClient().from("solar_estimates").select("*").eq("request_id", requestId)).data ?? [];

describe("POST /api/solar/calculate (requestId modes)", () => {
  it("saves the estimate for the owner and replaces it on recalculation", async () => {
    const res = await apiFetch<Calc>("/api/solar/calculate", { token: household.accessToken, body: { requestId } });
    expect(res.status).toBe(200);
    expect(res.json.data!.saved).toBe(true);
    expect(res.json.data!.estimate).toMatchObject({ capacityKw: 3, subsidyEstimate: 78000, ruleVersion: "pm-surya-ghar.v1" });
    expect(res.json.data!.estimate.updatedAt).toBeTruthy();
    expect(res.json.data!.estimate.assumptions).toBeTruthy();
    expect(res.json.data!.disclaimer).toMatch(/does not guarantee/i);
    let rows = await storedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].net_cost).toBe(102000);

    await household.client.from("household_requests").update({ monthly_units: 400, preferred_capacity_kw: 5 }).eq("id", requestId);
    const again = await apiFetch<Calc>("/api/solar/calculate", { token: household.accessToken, body: { requestId } });
    expect(again.status).toBe(200);
    rows = await storedRows();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].capacity_kw)).toBe(5);
    expect(rows[0].subsidy_estimate).toBe(78000);
    await household.client.from("household_requests").update({ monthly_units: 250, preferred_capacity_kw: 3 }).eq("id", requestId);
  });

  it("previews a what-if capacity without changing the stored row", async () => {
    await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { requestId } });
    const before = (await storedRows())[0];
    const res = await apiFetch<Calc>("/api/solar/calculate", { token: household.accessToken, body: { requestId, capacityOverrideKw: 2 } });
    expect(res.status).toBe(200);
    expect(res.json.data!.saved).toBe(false);
    expect(res.json.data!.estimate).toMatchObject({ capacityKw: 2, subsidyEstimate: 60000, capacityBasis: "preview" });
    const after = (await storedRows())[0];
    expect(after).toEqual(before);
  });

  it("rejects a request-preview override of 0.5 kW with 400", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { requestId, capacityOverrideKw: 0.5 } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for another household's request", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: other.accessToken, body: { requestId } });
    expect(res.status).toBe(404);
    expect(res.json.error?.code).toBe("NOT_FOUND");
  });

  it("returns 404 for an unknown request id", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { requestId: "00000000-0000-4000-8000-000000000000" } });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the request has no monthly units", async () => {
    const res = await apiFetch("/api/solar/calculate", { token: household.accessToken, body: { requestId: emptyRequestId } });
    expect(res.status).toBe(409);
    expect(res.json.error?.code).toBe("CONFLICT");
    expect(res.text).not.toMatch(/select |stack|violates/i);
  });

  it("returns 401 anonymously and 403 for a vendor", async () => {
    expect((await apiFetch("/api/solar/calculate", { body: { requestId } })).status).toBe(401);
    expect((await apiFetch("/api/solar/calculate", { token: vendor.accessToken, body: { requestId } })).status).toBe(403);
  });
});
