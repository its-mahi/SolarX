// POST /api/quotes/:id/withdraw (specs/005 T029).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus, requestStatus } from "../../helpers/quotes";
import { completeQuote } from "../../fixtures/quote-inputs";

let hh: TestUser, v1: TestUser, v2: TestUser;
let requestId: string;

type QuoteRes = { quote: { id: string; status: string } };
const submit = (user: TestUser) => apiFetch<QuoteRes>("/api/quotes", { method: "POST", token: user.accessToken, body: { ...completeQuote, request_id: requestId } });
const withdraw = (user: TestUser | null, id: string, body?: unknown) =>
  apiFetch<QuoteRes>(`/api/quotes/${id}/withdraw`, { method: "POST", token: user?.accessToken, body });
const statusOf = async (id: string) => (await adminClient().from("quotes").select("status").eq("id", id).single()).data!.status;

beforeAll(async () => {
  [hh, v1, v2] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  requestId = await createRequestWithStatus(hh.id, "open");
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("id", requestId);
  for (const u of [hh, v1, v2]) await deleteTestUser(u?.id);
});

describe("POST /api/quotes/:id/withdraw", () => {
  it("withdraws own submitted quote, keeps request quoted, then allows resubmit", async () => {
    const id = (await submit(v1)).json.data!.quote.id;
    const w = await withdraw(v1, id, {});
    expect(w.status).toBe(200);
    expect(w.json.data!.quote.status).toBe("withdrawn");
    expect(await requestStatus(requestId)).toBe("quoted");

    const again = await withdraw(v1, id);
    expect(again.status).toBe(409);
    expect(again.json.error!.details).toEqual([{ reason: "QUOTE_NOT_WITHDRAWABLE" }]);

    expect((await submit(v1)).status).toBe(201);
  });

  it("refuses accepted and rejected quotes", async () => {
    const id = (await submit(v2)).json.data!.quote.id;
    for (const s of ["accepted", "rejected"]) {
      await adminClient().from("quotes").update({ status: s }).eq("id", id);
      expect((await withdraw(v2, id)).status).toBe(409);
      expect(await statusOf(id)).toBe(s);
    }
  });

  it("returns identical 404 for another vendor's and unknown quotes", async () => {
    const id = (await adminClient().from("quotes").select("id").eq("request_id", requestId).eq("status", "submitted").limit(1).single()).data!.id;
    const other = await withdraw(v2, id);
    const unknown = await withdraw(v2, "22222222-2222-4222-8222-222222222222");
    expect(other.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(other.json).toEqual(unknown.json);
    expect(await statusOf(id)).toBe("submitted");
  });

  it("enforces role, session and input validation", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect((await withdraw(hh, id)).status).toBe(403);
    expect((await withdraw(null, id)).status).toBe(401);
    expect((await withdraw(v1, "not-a-uuid")).status).toBe(400);
    expect((await withdraw(v1, id, { status: "accepted" })).status).toBe(400);
  });
});
