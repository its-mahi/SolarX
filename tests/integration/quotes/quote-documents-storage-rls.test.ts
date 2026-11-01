// Storage RLS for the private quote-documents bucket (specs/009 T007), through user-scoped clients.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";
import { completeQuote } from "../../fixtures/quote-inputs";
import { apiFetch } from "../../helpers/api";

let hh: TestUser, otherHh: TestUser, v1: TestUser, v2: TestUser;
const bucket = (u: TestUser) => u.client.storage.from("quote-documents");
const objs: string[] = [];
const requests: string[] = [];
const bytes = new TextEncoder().encode("doc");
const path = (u: TestUser) => `${u.id}/${crypto.randomUUID()}/source.txt`;

beforeAll(async () => {
  [hh, otherHh, v1, v2] = await Promise.all([
    createTestUser({ role: "household" }), createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }), createTestUser({ role: "vendor" }),
  ]);
});
afterAll(async () => {
  await adminClient().storage.from("quote-documents").remove(objs);
  await adminClient().from("household_requests").delete().in("id", requests);
  for (const u of [hh, otherHh, v1, v2]) await deleteTestUser(u?.id);
});

describe("quote-documents storage policies", () => {
  it("the bucket is private", async () => {
    const { data } = await adminClient().storage.getBucket("quote-documents");
    expect(data?.public).toBe(false);
  });

  it("vendor uploads under own uid only; household cannot upload", async () => {
    const own = path(v1);
    expect((await bucket(v1).upload(own, bytes, { contentType: "text/plain" })).error).toBeNull();
    objs.push(own);
    expect((await bucket(v1).upload(path(v2), bytes, { contentType: "text/plain" })).error).not.toBeNull();
    expect((await bucket(hh).upload(path(hh), bytes, { contentType: "text/plain" })).error).not.toBeNull();
  });

  it("owner reads, other vendor cannot; nobody can update or delete", async () => {
    const p = path(v1);
    await bucket(v1).upload(p, bytes, { contentType: "text/plain" });
    objs.push(p);
    expect((await bucket(v1).download(p)).error).toBeNull();
    expect((await bucket(v2).download(p)).error).not.toBeNull();
    expect((await bucket(v1).upload(p, bytes, { contentType: "text/plain", upsert: true })).error).not.toBeNull();
    await bucket(v1).remove([p]);
    expect((await adminClient().storage.from("quote-documents").download(p)).error).toBeNull();
  });

  it("household reads only when a quote on its own request references the object", async () => {
    const rid = await createRequestWithStatus(hh.id, "open");
    requests.push(rid);
    const p = path(v1);
    await bucket(v1).upload(p, bytes, { contentType: "text/plain" });
    objs.push(p);
    expect((await bucket(hh).download(p)).error).not.toBeNull();
    const q = await apiFetch("/api/quotes", { token: v1.accessToken, body: { ...completeQuote, request_id: rid, source: "ai_extracted", source_document_path: p } });
    expect(q.status).toBe(201);
    expect((await bucket(hh).download(p)).error).toBeNull();
    expect((await bucket(otherHh).download(p)).error).not.toBeNull();
  });
});
