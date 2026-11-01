// POST /api/quotes (specs/005 T013). Requires the dev server on 127.0.0.1:3000.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithStatus, requestStatus } from "../../helpers/quotes";
import { completeQuote, injectionNotes, invalidQuotes, minimalQuote } from "../../fixtures/quote-inputs";

let hh: TestUser, v1: TestUser, v2: TestUser, vNoProfile: TestUser;
const requests: string[] = [];

const post = (user: TestUser | null, body: unknown) =>
  apiFetch<{ quote: { id: string; status: string; source: string; earthing_included: boolean | null; vendor_notes: string | null }; request_status: string }>(
    "/api/quotes",
    { method: "POST", token: user?.accessToken, body },
  );
async function newRequest(status: "draft" | "open" | "quoted" | "accepted" | "closed" = "open") {
  const id = await createRequestWithStatus(hh.id, status);
  requests.push(id);
  return id;
}
const count = async (requestId: string) =>
  (await adminClient().from("quotes").select("id", { count: "exact", head: true }).eq("request_id", requestId)).count;

beforeAll(async () => {
  [hh, v1, v2, vNoProfile] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
    createTestUser({ role: "vendor" }),
  ]);
  await adminClient().from("vendors").delete().eq("user_id", vNoProfile.id);
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().in("id", requests);
  for (const u of [hh, v1, v2, vNoProfile]) await deleteTestUser(u?.id);
});

describe("POST /api/quotes", () => {
  it("submits on open, moves request to quoted, then second vendor and duplicate", async () => {
    const id = await newRequest("open");
    const r = await post(v1, { ...completeQuote, request_id: id });
    expect(r.status).toBe(201);
    expect(r.json.data!.quote.status).toBe("submitted");
    expect(r.json.data!.quote.source).toBe("manual");
    expect(r.text).not.toContain("vendor_id");
    expect(await requestStatus(id)).toBe("quoted");

    const r2 = await post(v2, { ...completeQuote, request_id: id });
    expect(r2.status).toBe(201);
    expect(await requestStatus(id)).toBe("quoted");

    const dup = await post(v1, { ...completeQuote, request_id: id });
    expect(dup.status).toBe(409);
    expect(dup.json.error!.code).toBe("CONFLICT");
    expect(dup.json.error!.details).toEqual([{ reason: "DUPLICATE_ACTIVE_QUOTE" }]);
  });

  it("two concurrent identical submits give one 201 and one 409", async () => {
    const id = await newRequest("open");
    const [a, b] = await Promise.all([post(v1, { ...completeQuote, request_id: id }), post(v1, { ...completeQuote, request_id: id })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await count(id)).toBe(1);
  });

  it("404 for draft and unknown request; 409 for accepted/closed with no row", async () => {
    const draft = await newRequest("draft");
    expect((await post(v1, { ...completeQuote, request_id: draft })).status).toBe(404);
    expect((await post(v1, { ...completeQuote, request_id: "11111111-1111-4111-8111-111111111111" })).status).toBe(404);
    for (const s of ["accepted", "closed"] as const) {
      const id = await newRequest(s);
      const r = await post(v1, { ...completeQuote, request_id: id });
      expect(r.status).toBe(409);
      expect(r.json.error!.details).toEqual([{ reason: "REQUEST_NOT_QUOTABLE" }]);
      expect(await count(id)).toBe(0);
    }
  });

  it("rejects each invalid fixture with 400 and details", async () => {
    const id = await newRequest("open");
    for (const [name, { payload, path }] of Object.entries(invalidQuotes)) {
      const r = await post(v1, name === "missing request_id" ? payload : { ...payload, request_id: id });
      expect(r.status, name).toBe(400);
      expect(r.json.error!.code).toBe("VALIDATION_FAILED");
      if (path) expect(r.json.error!.details.map((d) => d.path), name).toContain(path);
    }
    expect(await count(id)).toBe(0);
  });

  it("enforces roles", async () => {
    const id = await newRequest("open");
    const body = { ...completeQuote, request_id: id };
    expect((await post(hh, body)).status).toBe(403);
    expect((await post(vNoProfile, body)).status).toBe(403);
    expect((await post(null, body)).status).toBe(401);
    expect(await count(id)).toBe(0);
  });

  it("stores unspecified earthing as null and injected notes verbatim", async () => {
    const id = await newRequest("open");
    const r = await post(v1, { ...minimalQuote, request_id: id, vendor_notes: injectionNotes });
    expect(r.status).toBe(201);
    expect(r.json.data!.quote.earthing_included).toBeNull();
    expect(r.json.data!.quote.vendor_notes).toBe(injectionNotes);
    const { data } = await adminClient().from("quotes").select("earthing_included, vendor_notes, status").eq("request_id", id).single();
    expect(data).toEqual({ earthing_included: null, vendor_notes: injectionNotes, status: "submitted" });
  });

  it("direct rpc with price 0 fails the CHECK and inserts nothing", async () => {
    const id = await newRequest("open");
    const r = await v1.client.rpc("submit_quote", {
      p_request_id: id, p_price: 0, p_capacity_kw: 3, p_panel_details: {}, p_inverter_details: {}, p_warranty_details: {},
      p_installation_days: 10, p_earthing_included: true, p_documentation_included: true, p_other_inclusions: [],
      p_exclusions: "", p_vendor_notes: "",
    });
    expect(r.error?.code).toBe("23514");
    expect(await count(id)).toBe(0);
    expect(await requestStatus(id)).toBe("open");
  });
});
