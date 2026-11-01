/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed JSON bodies */
// POST /api/quotes/extract: authorization, limits, success, failures (mock provider, in-process).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { createMockProvider } from "../../helpers/mock-ai-provider";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus } from "../../helpers/quotes";
import { apiFetch, BASE_URL } from "../../helpers/api";
import { completeQuote } from "../../fixtures/quote-inputs";
import * as out from "../../fixtures/quotes/extraction-outputs";
import { extractCall, file, fixtureText, fixturePdf, installMock, jpeg, listFolder, removeObjects, resetMock } from "./_extraction-setup";

let hh: TestUser, vendor: TestUser, noProfile: TestUser;
const requests: string[] = [];
let openId: string;

const body = async (res: Response) => JSON.parse(await res.text());
const reasonOf = (j: any) => j.error?.details?.[0]?.reason;
const quoteCount = async (rid: string) => (await adminClient().from("quotes").select("id", { count: "exact", head: true }).eq("request_id", rid)).count;

beforeAll(async () => {
  [hh, vendor, noProfile] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  await adminClient().from("vendors").delete().eq("user_id", noProfile.id);
  openId = await createRequestWithStatus(hh.id, "open");
  requests.push(openId);
});
afterEach(resetMock);
afterAll(async () => {
  await removeObjects([...(await listFolder(vendor.id))]);
  await adminClient().from("household_requests").delete().in("id", requests);
  for (const u of [hh, vendor, noProfile]) await deleteTestUser(u?.id);
});

describe("authorization and preconditions", () => {
  it("401 unauthenticated; 403 household; 403 vendor without profile; 404 unknown request", async () => {
    const mock = installMock([{ json: out.greenvoltValid }]);
    const f = { request_id: openId, text: "x" };
    // No cookies exist in-process, so the anonymous case goes through the running dev server.
    const anon = new FormData();
    anon.set("request_id", openId);
    anon.set("text", "x");
    const anonRes = await fetch(`${BASE_URL}/api/quotes/extract`, { method: "POST", body: anon, headers: { origin: BASE_URL } });
    expect(anonRes.status).toBe(401);
    const hhRes = await extractCall(hh.accessToken, f);
    expect(hhRes.status).toBe(403);
    expect(reasonOf(await body(hhRes))).toBe("role_not_allowed");
    const np = await extractCall(noProfile.accessToken, f);
    expect(np.status).toBe(403);
    expect(reasonOf(await body(np))).toBe("vendor_profile_required");
    expect((await extractCall(vendor.accessToken, { request_id: crypto.randomUUID(), text: "x" })).status).toBe(404);
    expect(mock.calls.length).toBe(0);
  });

  it("409 request_not_quotable (accepted after the vendor quoted) and active_quote_exists", async () => {
    const mock = installMock([{ json: out.greenvoltValid }]);
    const rid = await createRequestWithStatus(hh.id, "open");
    requests.push(rid);
    const q = await apiFetch("/api/quotes", { token: vendor.accessToken, body: { ...completeQuote, request_id: rid } });
    expect(q.status).toBe(201);
    const active = await extractCall(vendor.accessToken, { request_id: rid, text: "x" });
    expect(active.status).toBe(409);
    expect(reasonOf(await body(active))).toBe("active_quote_exists");
    await adminClient().from("household_requests").update({ status: "accepted" }).eq("id", rid);
    const closed = await extractCall(vendor.accessToken, { request_id: rid, text: "x" });
    expect(closed.status).toBe(409);
    expect(reasonOf(await body(closed))).toBe("request_not_quotable");
    expect(mock.calls.length).toBe(0);
  });
});

describe("input limits (no AI call, nothing stored)", () => {
  const cases: [string, Record<string, string | File | undefined>, number, string][] = [
    ["neither input", {}, 400, "exactly_one_input_required"],
    ["both inputs", { text: "x", file: file(jpeg(), "a.jpg", "image/jpeg") }, 400, "exactly_one_input_required"],
    ["20001 chars", { text: "a".repeat(20001) }, 413, "text_too_long"],
    ["5 MB + 1 file", { file: file(new Uint8Array(5 * 1024 * 1024 + 1), "a.pdf", "application/pdf") }, 413, "file_too_large"],
    ["webp", { file: file(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "), "a.webp", "image/webp") }, 400, "unsupported_file_type"],
    ["exe renamed pdf", { file: file(new TextEncoder().encode("MZ\x90 exe"), "a.pdf", "application/pdf") }, 400, "unsupported_file_type"],
    ["png declared as pdf", { file: file(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "a.pdf", "application/pdf") }, 400, "unsupported_file_type"],
  ];
  it.each(cases)("%s", async (_n, fields, status, reason) => {
    const mock = installMock([{ json: out.greenvoltValid }]);
    const before = (await listFolder(vendor.id)).length;
    const res = await extractCall(vendor.accessToken, { request_id: openId, ...fields });
    expect(res.status).toBe(status);
    expect(reasonOf(await body(res))).toBe(reason);
    expect(mock.calls.length).toBe(0);
    expect((await listFolder(vendor.id)).length).toBe(before);
  });
});

describe("success", () => {
  it("text: 200, stores text/plain source, no quote row, contract keys only", async () => {
    const mock = installMock([{ json: out.greenvoltValid }]);
    const before = await quoteCount(openId);
    const res = await extractCall(vendor.accessToken, { request_id: openId, text: fixtureText("clean") });
    expect(res.status).toBe(200);
    const { data } = await body(res);
    expect(Object.keys(data).sort()).toEqual(["discarded_fields", "document_vendor_name", "fields", "missing_fields", "model", "notice", "prefill", "prompt_version", "source_document"]);
    expect(data.missing_fields).toEqual(["earthing_included"]);
    expect(data.prefill).toMatchObject({ price: 145000, source: "ai_extracted", earthing_included: null });
    expect(data.source_document.path).toMatch(new RegExp(`^${vendor.id}/[0-9a-f-]{36}/source\\.txt$`));
    expect(data.source_document.mime_type).toBe("text/plain");
    expect(mock.calls[0].parts.some((p) => p.kind === "text" && p.trust === "untrusted")).toBe(true);
    const { data: blob } = await adminClient().storage.from("quote-documents").download(data.source_document.path);
    expect((await blob!.text()).replace(/\r\n/g, "\n").trim()).toBe(fixtureText("clean").trim());
    expect(await quoteCount(openId)).toBe(before);
  });

  it("pdf: provider request uses a file part and stores source.pdf", async () => {
    const mock = installMock([{ json: out.greenvoltValid }]);
    const res = await extractCall(vendor.accessToken, { request_id: openId, file: file(fixturePdf(), "q.pdf", "application/pdf") });
    expect(res.status).toBe(200);
    const { data } = await body(res);
    expect(data.source_document.path).toMatch(/source\.pdf$/);
    expect(data.source_document.kind).toBe("pdf");
    expect(mock.calls[0].parts.some((p) => p.kind === "file" && p.mimeType === "application/pdf")).toBe(true);
  });

  it("partially invalid output still succeeds with discarded fields", async () => {
    installMock([{ json: out.partialInvalid }]);
    const { data } = await body(await extractCall(vendor.accessToken, { request_id: openId, text: "x" }));
    expect(data.discarded_fields.sort()).toEqual(["capacity_kw", "inverter_details.type", "price_inr"]);
    expect(data.prefill.price).toBeNull();
  });
});

describe("AI failure leaves the manual form working", () => {
  it.each([
    ["timeout", { fail: "timeout" as const }],
    ["rate_limited", { fail: "rate_limited" as const }],
    ["provider_error", { fail: "provider_error" as const }],
    ["invalid_output notJson", { text: out.notJson }],
    ["invalid_output arrayRoot", { text: out.arrayRoot }],
  ])("%s -> 503, nothing stored", async (_n, step) => {
    installMock([step]);
    const before = (await listFolder(vendor.id)).length;
    const res = await extractCall(vendor.accessToken, { request_id: openId, text: "some quote" });
    expect(res.status).toBe(503);
    const j = await body(res);
    expect(j.error.code).toBe("AI_UNAVAILABLE");
    expect(j.error.message).toBe("Extraction unavailable — fill in the form manually");
    expect(j.error.details[0].reason).toBeTruthy();
    expect(JSON.stringify(j)).not.toContain("some quote");
    expect((await listFolder(vendor.id)).length).toBe(before);
  });

  it("not_configured and unsupported_input (PDF without document support)", async () => {
    setAiClientForTests(createAiClient({ providers: [createMockProvider({ configured: false, steps: [] })], config: { maxRetries: 0 } }));
    let res = await extractCall(vendor.accessToken, { request_id: openId, text: "x" });
    expect(res.status).toBe(503);
    expect(reasonOf(await body(res))).toBe("not_configured");
    installMock([{ json: out.greenvoltValid }], { supports: ["text"] });
    res = await extractCall(vendor.accessToken, { request_id: openId, file: file(fixturePdf(), "q.pdf", "application/pdf") });
    expect(res.status).toBe(503);
    expect(reasonOf(await body(res))).toBe("unsupported_input");
  });

  it("text falls back to a Groq mock; PDF never reaches the text-only fallback", async () => {
    const gemini = createMockProvider({ name: "gemini", steps: [{ fail: "provider_error" }] });
    const groq = createMockProvider({ name: "groq", supports: ["text"], steps: [{ json: out.greenvoltValid }] });
    setAiClientForTests(createAiClient({ providers: [gemini, groq], config: { geminiModel: "g", groqModel: "q", maxRetries: 0 }, sleep: async () => {} }));
    expect((await extractCall(vendor.accessToken, { request_id: openId, text: "x" })).status).toBe(200);
    expect(groq.calls.length).toBe(1);
    const res = await extractCall(vendor.accessToken, { request_id: openId, file: file(fixturePdf(), "q.pdf", "application/pdf") });
    expect(res.status).toBe(503);
    expect(groq.calls.length).toBe(1);
  });

  it("after a failure the same vendor submits a manual quote", async () => {
    installMock([{ fail: "provider_error" }]);
    const rid = await createRequestWithStatus(hh.id, "open");
    requests.push(rid);
    expect((await extractCall(vendor.accessToken, { request_id: rid, text: "x" })).status).toBe(503);
    const q = await apiFetch<{ quote: { source: string } }>("/api/quotes", { token: vendor.accessToken, body: { ...completeQuote, request_id: rid } });
    expect(q.status).toBe(201);
    expect(q.json.data!.quote.source).toBe("manual");
  });
});
