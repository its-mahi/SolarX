// POST /api/roof/analyze: authz, consent, preconditions, success, failures (mock provider only).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/roof/analyze/route";
import { setAiClientForTests } from "@/lib/ai/client";
import * as outputs from "../../fixtures/roof/ai-outputs";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { apiFetch } from "../../helpers/api";
import { bearerRequest, createRequestWithPhoto, installMock, rowsFor } from "./_setup";

let owner: TestUser;
let other: TestUser;
let vendor: TestUser;
const ctx = { params: Promise.resolve({}) };
const call = (token: string | null, body: unknown) => POST(bearerRequest("/api/roof/analyze", token, body), ctx);
const errOf = async (res: Response) => (await res.json()).error;

beforeAll(async () => {
  [owner, other, vendor] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
  ]);
});
afterEach(() => setAiClientForTests(null));
afterAll(async () => {
  await adminClient().from("household_requests").delete().in("user_id", [owner?.id, other?.id].filter(Boolean));
  for (const u of [owner, other, vendor]) await deleteTestUser(u?.id);
});

describe("authorization", () => {
  it("401 without a session, 403 for a vendor, 404 for another household", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    expect((await apiFetch("/api/roof/analyze", { body: { request_id: id } })).status).toBe(401);
    expect((await call(vendor.accessToken, { request_id: id })).status).toBe(403);
    const res = await call(other.accessToken, { request_id: id });
    expect(res.status).toBe(404);
    expect(mock.calls.length).toBe(0);
    expect(await rowsFor(id)).toHaveLength(0);
  });

  it("400 for a malformed body", async () => {
    expect((await call(owner.accessToken, { request_id: "nope" })).status).toBe(400);
    expect((await call(owner.accessToken, { request_id: crypto.randomUUID(), extra: 1 })).status).toBe(400);
  });
});

describe("consent and preconditions", () => {
  it("403 ai_consent_required with no provider call and no row", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id } = await createRequestWithPhoto(owner, { consent: false });
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(403);
    expect(JSON.stringify(await errOf(res))).toContain("ai_consent_required");
    expect(mock.calls.length).toBe(0);
    expect(await rowsFor(id)).toHaveLength(0);
  });

  it("consent withdrawal after a successful analysis blocks the next call", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    expect((await call(owner.accessToken, { request_id: id })).status).toBe(201);
    expect(mock.calls.length).toBe(1);
    const w = await owner.client.from("household_requests").update({ ai_consent: false }).eq("id", id);
    expect(w.error).toBeNull();
    expect((await call(owner.accessToken, { request_id: id })).status).toBe(403);
    expect(mock.calls.length).toBe(1);
    expect(await rowsFor(id)).toHaveLength(1);
  });

  it("409 request_not_analyzable for accepted requests", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    const up = await adminClient().from("household_requests").update({ status: "accepted" }).eq("id", id);
    expect(up.error).toBeNull();
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(409);
    expect(JSON.stringify(await errOf(res))).toContain("request_not_analyzable");
    expect(mock.calls.length).toBe(0);
  });

  it("409 roof_photo_missing when the request has no photo", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const ins = await owner.client.from("household_requests").insert({ user_id: owner.id, ai_consent: true }).select().single();
    const res = await call(owner.accessToken, { request_id: ins.data!.id });
    expect(res.status).toBe(409);
    expect(JSON.stringify(await errOf(res))).toContain("roof_photo_missing");
    expect(mock.calls.length).toBe(0);
  });

  it("400 roof_photo_unsupported for non-image bytes, with no provider call", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id } = await createRequestWithPhoto(owner, { consent: true, bytes: new TextEncoder().encode("not an image at all") });
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await errOf(res))).toContain("roof_photo_unsupported");
    expect(mock.calls.length).toBe(0);
    expect(await rowsFor(id)).toHaveLength(0);
  });
});

describe("analysis outcome", () => {
  it("201 with a completed row; provider sees only instruction and image", async () => {
    const mock = installMock([{ json: outputs.validObstructed }]);
    const { id, path } = await createRequestWithPhoto(owner, { consent: true });
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(201);
    const { assessment } = (await res.json()).data;
    expect(assessment.status).toBe("completed");
    expect(assessment.is_current_photo).toBe(true);
    expect(assessment.site_survey_required).toBe(true);
    expect(assessment.limitations.length).toBeGreaterThanOrEqual(3);
    expect(assessment).not.toHaveProperty("roof_photo_path");
    expect(assessment).not.toHaveProperty("failure_reason");
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "completed", model: "mock-model", prompt_version: "roof-analysis.v1", roof_photo_path: path });

    const parts = mock.calls[0].parts;
    expect(parts.filter((p) => p.kind === "file")).toHaveLength(1);
    expect(JSON.stringify(parts.map((p) => (p.kind === "file" ? "" : p.text))).toLowerCase()).not.toMatch(/address|latitude|budget|plot 12/);
  });

  it("strips over-reaching keys from the stored row and response", async () => {
    installMock([{ json: outputs.overReaching }]);
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(201);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/roof_area_sqm|capacity_kw|shading_hours|area_m2/);
    expect(JSON.stringify(await rowsFor(id))).not.toMatch(/roof_area_sqm|capacity_kw|shading_hours|area_m2/);
  });

  it.each([
    ["notJson", { text: outputs.notJson }],
    ["badConfidence", { json: outputs.badConfidence }],
    ["wrongTypes", { json: outputs.wrongTypes }],
    ["tooMany", { json: outputs.tooMany }],
    ["tooLong", { json: outputs.tooLong }],
  ])("malformed output (%s) -> 503 AI_UNAVAILABLE and a failed row", async (_name, step) => {
    installMock([step]);
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    const res = await call(owner.accessToken, { request_id: id });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("AI_UNAVAILABLE");
    expect(body.error.details[0].reason).toBe("invalid_output");
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "failed", failure_reason: "invalid_output", observations: [], potential_obstructions: [] });
  });

  it.each(["timeout", "rate_limited", "provider_error"] as const)(
    "provider %s -> 503, failed row, request flow unaffected",
    async (kind) => {
      installMock([{ fail: kind }]);
      const { id } = await createRequestWithPhoto(owner, { consent: true, publish: false });
      const res = await call(owner.accessToken, { request_id: id });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.details[0]).toMatchObject({ reason: kind, retryable: true });
      expect(JSON.stringify(body)).not.toMatch(/stack|select |SUPABASE|mock-model/i);
      const rows = await rowsFor(id);
      expect(rows[0]).toMatchObject({ status: "failed", failure_reason: kind });
      expect(body.error.details[0].assessment_id).toBe(rows[0].id);
      // The request can still be published afterwards.
      const pub = await owner.client.from("household_requests").update({ status: "open" }).eq("id", id);
      expect(pub.error).toBeNull();
    },
  );
});
