// POST /api/quotes with source = ai_extracted (specs/009 T013). Needs the dev server on 127.0.0.1:3000.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";
import { completeQuote } from "../../fixtures/quote-inputs";
import { greenvoltValid } from "../../fixtures/quotes/extraction-outputs";
import { extractCall, installMock, listFolder, removeObjects, resetMock } from "./_extraction-setup";

let hh: TestUser, v1: TestUser, v2: TestUser;
const requests: string[] = [];
const post = (user: TestUser, body: unknown) => apiFetch<{ quote: { source: string } }>("/api/quotes", { token: user.accessToken, body });
const newRequest = async () => {
  const id = await createRequestWithStatus(hh.id, "open");
  requests.push(id);
  return id;
};
async function extractedPath(vendor: TestUser, requestId: string): Promise<string> {
  installMock([{ json: greenvoltValid }]);
  const res = await extractCall(vendor.accessToken, { request_id: requestId, text: "quote text" });
  return JSON.parse(await res.text()).data.source_document.path;
}

beforeAll(async () => {
  [hh, v1, v2] = await Promise.all([createTestUser({ role: "household" }), createTestUser({ role: "vendor" }), createTestUser({ role: "vendor" })]);
});
afterEach(resetMock);
afterAll(async () => {
  await removeObjects([...(await listFolder(v1.id)), ...(await listFolder(v2.id))]);
  await adminClient().from("household_requests").delete().in("id", requests);
  for (const u of [hh, v1, v2]) await deleteTestUser(u?.id);
});

describe("POST /api/quotes with a source document", () => {
  it("201 ai_extracted with the vendor's own existing document", async () => {
    const rid = await newRequest();
    const path = await extractedPath(v1, rid);
    const r = await post(v1, { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: path });
    expect(r.status).toBe(201);
    expect(r.json.data!.quote.source).toBe("ai_extracted");
    expect(r.text).not.toContain(path);
    const row = await adminClient().from("quotes").select("source, source_document_path").eq("request_id", rid).single();
    expect(row.data).toEqual({ source: "ai_extracted", source_document_path: path });
  });

  it("403 source_document_not_owned for another vendor's path", async () => {
    const rid = await newRequest();
    const foreign = await extractedPath(v2, rid);
    const r = await post(v1, { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: foreign });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.json.error)).toContain("source_document_not_owned");
  });

  it("400 source_document_missing for an own path with no object", async () => {
    const rid = await newRequest();
    const path = `${v1.id}/${crypto.randomUUID()}/source.txt`;
    const r = await post(v1, { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: path });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.json.error)).toContain("source_document_missing");
  });

  it("400 for ai_extracted without a path, a malformed path, or a manual quote with a path", async () => {
    const rid = await newRequest();
    expect((await post(v1, { ...completeQuote, request_id: rid, source: "ai_extracted" })).status).toBe(400);
    expect((await post(v1, { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: "../x" })).status).toBe(400);
    const path = await extractedPath(v1, rid);
    expect((await post(v1, { ...completeQuote, request_id: rid, source: "manual", source_document_path: path })).status).toBe(400);
  });

  it("manual quotes behave as before", async () => {
    const rid = await newRequest();
    const r = await post(v1, { ...completeQuote, request_id: rid });
    expect(r.status).toBe(201);
    expect(r.json.data!.quote.source).toBe("manual");
  });

  it("the database refuses ai_extracted without a document", async () => {
    const rid = await newRequest();
    const vendor = await adminClient().from("vendors").select("id").eq("user_id", v1.id).single();
    const { error } = await adminClient().from("quotes").insert({
      request_id: rid, vendor_id: vendor.data!.id, price: 150000, capacity_kw: 3, installation_days: 10, source: "ai_extracted",
    });
    expect(error?.message).toContain("quotes_ai_extracted_requires_document");
  });
});
