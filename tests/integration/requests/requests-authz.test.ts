// Authorization matrix for the request API: other household, vendor, anonymous (FR-021, FR-024).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch, cookieHeaderFrom } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { completeDraft, createDraftViaApi, publishViaApi, uploadPhotoViaApi, type RequestDto } from "../../helpers/requests";

let a: TestUser;
let b: TestUser;
let vendor: TestUser;
let draftId: string;
let openId: string;

beforeAll(async () => {
  [a, b, vendor] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
  ]);
  draftId = (await createDraftViaApi(a.accessToken)).id;
  openId = (await completeDraft(a.accessToken)).id;
  expect((await publishViaApi(a.accessToken, openId)).status).toBe(200);
});
afterAll(async () => {
  await adminClient().from("household_requests").delete().in("user_id", [a?.id, b?.id].filter(Boolean));
  for (const u of [a, b, vendor]) await deleteTestUser(u?.id);
});

type Op = (token: string | undefined, id: string) => Promise<{ status: number }>;
const operations: Record<string, Op> = {
  get: (token, id) => apiFetch(`/api/requests/${id}`, { token }),
  patch: (token, id) => apiFetch(`/api/requests/${id}`, { token, method: "PATCH", body: { ai_consent: false } }),
  publish: (token, id) => apiFetch(`/api/requests/${id}/publish`, { token, method: "POST", body: {} }),
  photo: async (token, id) => {
    if (!token) return apiFetch(`/api/requests/${id}/photo`, { method: "POST", body: {} });
    return uploadPhotoViaApi(token, id);
  },
  list: (token) => apiFetch(`/api/requests`, { token }),
  create: (token) => apiFetch(`/api/requests`, { token, method: "POST", body: {} }),
};

describe("request authorization matrix", () => {
  it("hides A's draft and published request from household B", async () => {
    for (const id of [draftId, openId]) {
      for (const name of ["get", "patch", "publish", "photo"]) {
        expect((await operations[name](b.accessToken, id)).status, `${name} ${id}`).toBe(404);
      }
    }
    const { data } = await adminClient().from("household_requests").select("status, roof_photo_path, ai_consent").in("id", [draftId, openId]);
    expect(data!.filter((r) => r.status === "open")).toHaveLength(1);
    expect(data!.find((r) => r.status === "draft")!.roof_photo_path).toBeNull();
  });

  it("never lists A's ids to B", async () => {
    const res = await apiFetch<{ items: RequestDto[] }>("/api/requests", { token: b.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.data!.items).toEqual([]);
    expect(res.text).not.toContain(draftId);
  });

  it("forbids vendors from every household operation (vendor reads belong to spec 004)", async () => {
    for (const name of ["create", "patch", "publish", "photo"]) {
      expect((await operations[name](vendor.accessToken, draftId)).status, name).toBe(403);
    }
  });

  it("requires sign-in for every operation", async () => {
    for (const name of Object.keys(operations)) {
      expect((await operations[name](undefined, draftId)).status, name).toBe(401);
    }
  });

  it("rejects non-UUID ids and cross-site cookie requests", async () => {
    expect((await apiFetch("/api/requests/nope", { token: a.accessToken })).status).toBe(400);
    expect((await apiFetch("/api/requests/nope/publish", { token: a.accessToken, method: "POST", body: {} })).status).toBe(400);

    const signIn = await apiFetch("/api/auth/demo", { body: { account: "household" } });
    const cookie = cookieHeaderFrom(signIn.headers);
    const cross = await apiFetch("/api/requests", { cookie, method: "POST", body: {}, origin: "https://evil.example" });
    expect(cross.status).toBe(403);
  });
});
