// POST /api/requests/:id/close (specs/007 T028).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { completeQuote } from "../../fixtures/quote-inputs";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { acceptBody, createWorld, quoteStatus, seedRequest, acceptanceCount, type AcceptanceWorld } from "../../helpers/acceptance";

let w: AcceptanceWorld;
let other: TestUser;
const close = (token: string | undefined, id: string, body: unknown = acceptBody) =>
  apiFetch<{ request: { id: string; status: string } }>(`/api/requests/${id}/close`, { method: "POST", token, body });

beforeAll(async () => {
  w = await createWorld(2);
  other = await createTestUser({ role: "household" });
});
afterAll(async () => {
  await w.cleanup();
  await deleteTestUser(other?.id);
});

describe("close request", () => {
  it("closes an accepted request without touching acceptance or quotes; then 409 and not quotable", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted" });
    expect((await apiFetch(`/api/quotes/${quoteIds[0]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody })).status).toBe(200);

    const res = await close(w.household.accessToken, requestId);
    expect(res.status).toBe(200);
    expect(res.json.data!.request.status).toBe("closed");
    expect(await acceptanceCount(requestId)).toBe(1);
    expect(await quoteStatus(quoteIds[0])).toBe("accepted");
    expect(await quoteStatus(quoteIds[1])).toBe("rejected");

    const again = await close(w.household.accessToken, requestId);
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.json.error!.details)).toContain("REQUEST_NOT_CLOSABLE");

    const sub = await apiFetch("/api/quotes", { method: "POST", token: w.vendors[0].accessToken, body: { ...completeQuote, request_id: requestId } });
    expect(sub.status).toBe(409);
    expect(JSON.stringify(sub.json.error!.details)).toContain("REQUEST_NOT_QUOTABLE");
  });

  it("refuses open and quoted requests with 409", async () => {
    for (const status of ["open", "quoted"] as const) {
      const { requestId } = await seedRequest(w, { status, vendorIdx: [0] });
      const res = await close(w.household.accessToken, requestId);
      expect(res.status).toBe(409);
      const { data } = await adminClient().from("household_requests").select("status").eq("id", requestId).single();
      expect(data!.status).toBe(status);
    }
  });

  it("enforces ownership, role, session and body", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0] });
    await apiFetch(`/api/quotes/${quoteIds[0]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
    expect((await close(other.accessToken, requestId)).status).toBe(404);
    expect((await close(w.vendors[0].accessToken, requestId)).status).toBe(403);
    expect((await close(undefined, requestId)).status).toBe(401);
    expect((await close(w.household.accessToken, requestId, {})).status).toBe(400);
    expect((await close(w.household.accessToken, "bad-id")).status).toBe(400);
    const { data } = await adminClient().from("household_requests").select("status").eq("id", requestId).single();
    expect(data!.status).toBe("accepted");
  });
});
