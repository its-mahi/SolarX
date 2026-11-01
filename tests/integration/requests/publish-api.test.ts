import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { completeDraft, createDraftViaApi, publishViaApi, type RequestDto } from "../../helpers/requests";

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ role: "household" });
});
afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("user_id", user.id);
  await deleteTestUser(user?.id);
});

describe("POST /api/requests/:id/publish", () => {
  it("lists every missing item for an incomplete draft", async () => {
    const empty = await createDraftViaApi(user.accessToken, {});
    const res = await publishViaApi(user.accessToken, empty.id);
    expect(res.status).toBe(400);
    expect(res.json.error!.code).toBe("VALIDATION_FAILED");
    expect(res.json.error!.details.map((d) => d.path)).toEqual(["location", "address_text", "locality", "monthly_units", "budget", "roof_photo"]);
  });

  it("publishes a complete draft once and locks it", async () => {
    const draft = await completeDraft(user.accessToken);
    const res = await publishViaApi(user.accessToken, draft.id);
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ status: "open", next_action: { kind: "wait" } });

    const again = await publishViaApi(user.accessToken, draft.id);
    expect(again.status).toBe(409);
    expect(again.json.error!.message).toBe("This request is already published");

    const edit = await apiFetch(`/api/requests/${draft.id}`, { token: user.accessToken, method: "PATCH", body: { monthly_units: 300 } });
    expect(edit.status).toBe(409);
    expect(edit.json.error!.message).toBe("This request has been published and can no longer be edited");
  });

  it("lets exactly one of two concurrent publishes win", async () => {
    const draft = await completeDraft(user.accessToken);
    const results = await Promise.all([publishViaApi(user.accessToken, draft.id), publishViaApi(user.accessToken, draft.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("rejects a body on publish", async () => {
    const draft = await completeDraft(user.accessToken);
    const res = await apiFetch<RequestDto>(`/api/requests/${draft.id}/publish`, { token: user.accessToken, method: "POST", body: { status: "open" } });
    expect(res.status).toBe(400);
  });
});
