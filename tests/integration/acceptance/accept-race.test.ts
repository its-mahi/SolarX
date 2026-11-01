// Atomicity under concurrency, 50 iterations each (specs/007 T010).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { completeQuote } from "../../fixtures/quote-inputs";
import { acceptBody, acceptanceCount, createWorld, quoteStatus, seedRequest, type AcceptanceWorld } from "../../helpers/acceptance";

const ITERATIONS = 50;
let w: AcceptanceWorld;
const accept = (id: string) => apiFetch(`/api/quotes/${id}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
const withdraw = (id: string) => apiFetch(`/api/quotes/${id}/withdraw`, { method: "POST", token: w.vendors[0].accessToken, body: {} });
const submit = (requestId: string) =>
  apiFetch("/api/quotes", { method: "POST", token: w.vendors[2].accessToken, body: { ...completeQuote, request_id: requestId } });
const reqStatus = async (id: string) => (await adminClient().from("household_requests").select("status").eq("id", id).single()).data!.status;

beforeAll(async () => {
  w = await createWorld(3);
});
afterAll(async () => {
  await w.cleanup();
});

describe("accept race", () => {
  it(`two different quotes: exactly one 200 + one 409 (${ITERATIONS}x)`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1, 2] });
      const [r1, r2] = await Promise.all([accept(quoteIds[0]), accept(quoteIds[1])]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const statuses = await Promise.all(quoteIds.map(quoteStatus));
      expect(statuses.filter((s) => s === "accepted")).toHaveLength(1);
      expect(statuses.filter((s) => s === "rejected")).toHaveLength(2);
      expect(await acceptanceCount(requestId)).toBe(1);
      expect(await reqStatus(requestId)).toBe("accepted");
    }
  }, 120_000);

  it(`same quote twice: one 200 + one 409 (${ITERATIONS}x)`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
      const [r1, r2] = await Promise.all([accept(quoteIds[0]), accept(quoteIds[0])]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect(await acceptanceCount(requestId)).toBe(1);
      expect(await quoteStatus(quoteIds[0])).toBe("accepted");
    }
  }, 120_000);

  it(`accept vs withdraw: exactly one wins, state consistent (${ITERATIONS}x)`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
      const [a, wd] = await Promise.all([accept(quoteIds[0]), withdraw(quoteIds[0])]);
      expect([a.status, wd.status].filter((s) => s === 200)).toHaveLength(1);
      const s = await quoteStatus(quoteIds[0]);
      if (a.status === 200) {
        expect(s).toBe("accepted");
        expect(wd.status).toBe(409);
        expect(await acceptanceCount(requestId)).toBe(1);
      } else {
        expect(s).toBe("withdrawn");
        expect(a.status).toBe(409);
        expect(await acceptanceCount(requestId)).toBe(0);
      }
    }
  }, 120_000);

  it(`accept vs new submit: no submitted quote remains on an accepted request (${ITERATIONS}x)`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
      const [a] = await Promise.all([accept(quoteIds[0]), submit(requestId)]);
      expect(a.status).toBe(200);
      const { data } = await adminClient().from("quotes").select("status").eq("request_id", requestId);
      expect(data!.filter((q) => q.status === "submitted")).toHaveLength(0);
      expect(data!.filter((q) => q.status === "accepted")).toHaveLength(1);
    }
  }, 120_000);
});
