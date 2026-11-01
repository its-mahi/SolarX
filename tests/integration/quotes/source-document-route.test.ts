/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed JSON bodies */
// GET /api/quotes/:id/source-document (specs/009 T030).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { apiFetch, BASE_URL } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";
import { completeQuote } from "../../fixtures/quote-inputs";
import { greenvoltValid } from "../../fixtures/quotes/extraction-outputs";
import { extractCall, installMock, listFolder, removeObjects, resetMock, sourceDocCall } from "./_extraction-setup";

let hh: TestUser, otherHh: TestUser, v1: TestUser, v2: TestUser;
let rid: string, aiQuote: string, manualQuote: string;
const requests: string[] = [];
const get = async (u: TestUser, id: string) => {
  const res = await sourceDocCall(u.accessToken, id);
  return { status: res.status, json: JSON.parse(await res.text()) as any };
};

beforeAll(async () => {
  [hh, otherHh, v1, v2] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  rid = await createRequestWithStatus(hh.id, "open");
  requests.push(rid);
  installMock([{ json: greenvoltValid }]);
  const ex = JSON.parse(await (await extractCall(v1.accessToken, { request_id: rid, text: "quote text" })).text());
  const a = await apiFetch<{ quote: { id: string } }>("/api/quotes", {
    token: v1.accessToken,
    body: { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: ex.data.source_document.path },
  });
  aiQuote = a.json.data!.quote.id;
  const m = await apiFetch<{ quote: { id: string } }>("/api/quotes", { token: v2.accessToken, body: { ...completeQuote, request_id: rid } });
  manualQuote = m.json.data!.quote.id;
  resetMock();
});
afterEach(resetMock);
afterAll(async () => {
  await removeObjects(await listFolder(v1.id));
  await adminClient().from("household_requests").delete().in("id", requests);
  for (const u of [hh, otherHh, v1, v2]) await deleteTestUser(u?.id);
});

describe("source document access", () => {
  it("owning household and owning vendor get a short-lived URL that serves the text", async () => {
    for (const u of [hh, v1]) {
      const r = await get(u, aiQuote);
      expect(r.status).toBe(200);
      const d = r.json.data;
      expect(d).toMatchObject({ kind: "text", mime_type: "text/plain", label: "Vendor-provided document — not verified" });
      expect(Date.parse(d.expires_at)).toBeLessThanOrEqual(Date.now() + 600_000);
      const body = await (await fetch(d.url)).text();
      expect(body.trim()).toBe("quote text");
    }
  });
  it("other household and other vendor get 404", async () => {
    expect((await get(otherHh, aiQuote)).status).toBe(404);
    expect((await get(v2, aiQuote)).status).toBe(404);
  });
  it("manual quote -> 404 no_source_document", async () => {
    const r = await get(v2, manualQuote);
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.json.error)).toContain("no_source_document");
  });
  it("non-UUID -> 400; unauthenticated -> 401", async () => {
    expect((await get(hh, "nope")).status).toBe(400);
    const res = await fetch(`${BASE_URL}/api/quotes/${aiQuote}/source-document`);
    expect(res.status).toBe(401);
  });
});
