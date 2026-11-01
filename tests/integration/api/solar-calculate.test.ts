// POST /api/solar/calculate: preview modes that need no saved request. Saved-request modes
// (requestId) are added with feature 002's household_requests table. Needs supabase + `npm run dev`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

type Calc = { saved: boolean; estimate: { capacityKw: number; subsidyEstimate: number; capacityBasis: string; ruleVersion: string; assumptions: unknown; updatedAt?: string }; disclaimer: string };

let household: TestUser;
let vendor: TestUser;

beforeAll(async () => {
  household = await createTestUser({ role: "household" });
  vendor = await createTestUser({ role: "vendor" });
});
afterAll(async () => {
  await Promise.all([household?.id, vendor?.id].map(deleteTestUser));
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
