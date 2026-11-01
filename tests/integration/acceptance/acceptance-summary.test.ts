// household_acceptance_summary and the `acceptance` field of GET /api/requests/:id/quotes (specs/007 T016, T018).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { acceptBody, createWorld, seedRequest, type AcceptanceWorld } from "../../helpers/acceptance";

let w: AcceptanceWorld;
let other: TestUser;
let requestId: string, quoteIds: string[];

beforeAll(async () => {
  w = await createWorld(2);
  other = await createTestUser({ role: "household" });
  ({ requestId, quoteIds } = await seedRequest(w, { status: "quoted" }));
});
afterAll(async () => {
  await w.cleanup();
  await deleteTestUser(other?.id);
});

describe("GET /api/requests/:id/quotes acceptance field", () => {
  type QuotesBody = { acceptance: { quoteId: string; acceptedAt: string; vendor: { companyName: string; isDemo: boolean; phone: string | null }; price: number; capacityKw: number } | null };

  it("is null before acceptance and carries the accepted vendor's data after", async () => {
    // Own request, so the database-function tests below still start from "not accepted".
    const own = await seedRequest(w, { status: "quoted" });
    const before = await apiFetch<QuotesBody>(`/api/requests/${own.requestId}/quotes`, { token: w.household.accessToken });
    expect(before.status).toBe(200);
    expect(before.json.data!.acceptance).toBeNull();

    const accept = await apiFetch(`/api/quotes/${own.quoteIds[1]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
    expect(accept.status).toBe(200);

    const after = await apiFetch<QuotesBody>(`/api/requests/${own.requestId}/quotes`, { token: w.household.accessToken });
    expect(after.status).toBe(200);
    expect(after.json.data!.acceptance).toMatchObject({ quoteId: own.quoteIds[1], price: 151000, capacityKw: 3, vendor: { companyName: "Test Solar Co", isDemo: false } });
    expect(after.json.data!.acceptance!.acceptedAt).toBeTruthy();
  });
});

describe("household_acceptance_summary", () => {
  it("returns no row before acceptance, the accepted vendor's data after", async () => {
    const before = await w.household.client.rpc("household_acceptance_summary", { p_request_id: requestId });
    expect(before.error).toBeNull();
    expect(before.data).toEqual([]);

    const res = await apiFetch(`/api/quotes/${quoteIds[0]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
    expect(res.status).toBe(200);

    const after = await w.household.client.rpc("household_acceptance_summary", { p_request_id: requestId });
    expect(after.data).toHaveLength(1);
    expect(after.data![0]).toMatchObject({
      quote_id: quoteIds[0],
      vendor_company_name: "Test Solar Co",
      vendor_is_demo: false,
      price: 150000,
      capacity_kw: 3,
    });
    expect(after.data![0].accepted_at).toBeTruthy();
  });

  it("returns nothing to another household and errors for a vendor", async () => {
    const o = await other.client.rpc("household_acceptance_summary", { p_request_id: requestId });
    expect(o.data ?? []).toEqual([]);
    const v = await w.vendors[0].client.rpc("household_acceptance_summary", { p_request_id: requestId });
    expect(v.error).not.toBeNull();
    expect(v.data ?? []).toEqual([]);
  });
});
