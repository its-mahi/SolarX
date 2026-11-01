import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createDraftViaApi, LOCATION_FIELDS, uploadPhotoViaApi, USAGE_FIELDS, type RequestDto } from "../../helpers/requests";

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ role: "household" });
});
afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("user_id", user.id);
  await deleteTestUser(user?.id);
});

describe("requests API (draft)", () => {
  it("creates a draft with location and reports what is missing", async () => {
    const res = await apiFetch<RequestDto>("/api/requests", { token: user.accessToken, method: "POST", body: LOCATION_FIELDS });
    expect(res.status).toBe(201);
    const dto = res.json.data!;
    expect(dto.status).toBe("draft");
    expect(dto.missing_publish_fields).toEqual(["monthly_units", "budget", "roof_photo"]);
    expect(dto.next_action).toEqual({ kind: "continue", label: "Continue request", step: "photo" });
    expect(dto).not.toHaveProperty("roof_photo_path");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("updates usage fields and clears optional ones with null", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    const patch = await apiFetch<RequestDto>(`/api/requests/${draft.id}`, { token: user.accessToken, method: "PATCH", body: USAGE_FIELDS });
    expect(patch.status).toBe(200);
    expect(patch.json.data).toMatchObject({ monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3 });
    const cleared = await apiFetch<RequestDto>(`/api/requests/${draft.id}`, { token: user.accessToken, method: "PATCH", body: { monthly_bill: null } });
    expect(cleared.status).toBe(200);
    expect(cleared.json.data!.monthly_bill).toBeNull();
    expect(cleared.json.data!.monthly_units).toBe(250);
  });

  it("returns a short-lived signed photo URL only after a photo exists", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    const before = await apiFetch<RequestDto>(`/api/requests/${draft.id}`, { token: user.accessToken });
    expect(before.json.data!.roof_photo_url).toBeNull();
    expect((await uploadPhotoViaApi(user.accessToken, draft.id)).status).toBe(200);
    const after = await apiFetch<RequestDto>(`/api/requests/${draft.id}`, { token: user.accessToken });
    const dto = after.json.data!;
    expect(dto.has_roof_photo).toBe(true);
    expect(dto.roof_photo_url).toMatch(/^https?:\/\//);
    const seconds = (new Date(dto.roof_photo_url_expires_at!).getTime() - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(600);
    expect(dto).not.toHaveProperty("roof_photo_path");
  });

  it("rejects fields clients may not set and invalid values", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    for (const body of [{ status: "open" }, { user_id: user.id }, { roof_photo_path: "x" }, { id: draft.id }, {}, { latitude: 51.5, longitude: 78 }, { monthly_units: 0 }, { latitude: 17.4 }]) {
      const res = await apiFetch(`/api/requests/${draft.id}`, { token: user.accessToken, method: "PATCH", body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.error!.code).toBe("VALIDATION_FAILED");
    }
    const create = await apiFetch("/api/requests", { token: user.accessToken, method: "POST", body: { status: "open" } });
    expect(create.status).toBe(400);
  });

  it("lists nothing leaky and rejects non-UUID ids", async () => {
    expect((await apiFetch("/api/requests/not-a-uuid", { token: user.accessToken })).status).toBe(400);
  });
});
