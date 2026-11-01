// GET /api/requests/[id]/roof-assessment (mock provider only).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/roof/analyze/route";
import { GET } from "@/app/api/requests/[id]/roof-assessment/route";
import { setAiClientForTests } from "@/lib/ai/client";
import * as outputs from "../../fixtures/roof/ai-outputs";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { apiFetch } from "../../helpers/api";
import { bearerRequest, createRequestWithPhoto, installMock } from "./_setup";

let owner: TestUser;
let other: TestUser;
let vendor: TestUser;
const get = (id: string, token: string | null) =>
  GET(bearerRequest(`/api/requests/${id}/roof-assessment`, token), { params: Promise.resolve({ id }) });
const analyze = (id: string) => POST(bearerRequest("/api/roof/analyze", owner.accessToken, { request_id: id }), { params: Promise.resolve({}) });

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
  it("401 / vendor 403 / non-owner 404 / non-UUID 400", async () => {
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    expect((await apiFetch(`/api/requests/${id}/roof-assessment`)).status).toBe(401);
    expect((await get(id, vendor.accessToken)).status).toBe(403);
    expect((await get(id, other.accessToken)).status).toBe(404);
    expect((await get("not-a-uuid", owner.accessToken)).status).toBe(400);
  });
});

describe("state", () => {
  it("empty, then completed, then failed attempt, then newest completed, then stale photo", async () => {
    const { id } = await createRequestWithPhoto(owner, { consent: true });
    let data = (await (await get(id, owner.accessToken)).json()).data;
    expect(data.latest_completed).toBeNull();
    expect(data.latest_attempt).toBeNull();
    expect(data.request).toEqual({ has_roof_photo: true, ai_consent: true, analyzable: true });

    installMock([{ json: outputs.validObstructed }]);
    expect((await analyze(id)).status).toBe(201);
    data = (await (await get(id, owner.accessToken)).json()).data;
    expect(data.latest_completed.is_current_photo).toBe(true);
    const firstId = data.latest_completed.id;

    installMock([{ fail: "provider_error" }]);
    expect((await analyze(id)).status).toBe(503);
    data = (await (await get(id, owner.accessToken)).json()).data;
    expect(data.latest_completed.id).toBe(firstId);
    expect(data.latest_attempt.status).toBe("failed");

    installMock([{ json: outputs.validEmpty }]);
    expect((await analyze(id)).status).toBe(201);
    data = (await (await get(id, owner.accessToken)).json()).data;
    expect(data.latest_completed.id).not.toBe(firstId);
    expect(data.latest_completed.observations).toEqual([]);
    expect(data.latest_attempt.status).toBe("completed");

    // Photo replaced after analysis (privileged change) -> not the current photo.
    const up = await adminClient().from("household_requests").update({ roof_photo_path: `${owner.id}/${id}/other.jpg` }).eq("id", id);
    expect(up.error).toBeNull();
    data = (await (await get(id, owner.accessToken)).json()).data;
    expect(data.latest_completed.is_current_photo).toBe(false);
  });
});
