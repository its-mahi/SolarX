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

const patch = (id: string, body: unknown) => apiFetch<RequestDto>(`/api/requests/${id}`, { token: user.accessToken, method: "PATCH", body });

describe("AI consent", () => {
  it("can be given and removed on a draft", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    expect(draft.ai_consent).toBe(false);
    expect((await patch(draft.id, { ai_consent: true })).json.data!.ai_consent).toBe(true);
    expect((await patch(draft.id, { ai_consent: false })).json.data!.ai_consent).toBe(false);
  });

  it("can only be withdrawn after publishing", async () => {
    const draft = await completeDraft(user.accessToken);
    await patch(draft.id, { ai_consent: true });
    expect((await publishViaApi(user.accessToken, draft.id)).status).toBe(200);

    const regrant = await patch(draft.id, { ai_consent: true });
    expect(regrant.status).toBe(409);
    expect(regrant.json.error!.message).toBe("Consent can only be given before publishing");

    const mixed = await patch(draft.id, { ai_consent: false, budget: 1 });
    expect(mixed.status).toBe(409);
    expect(mixed.json.error!.message).toBe("This request has been published and can no longer be edited");

    const withdraw = await patch(draft.id, { ai_consent: false });
    expect(withdraw.status).toBe(200);
    expect(withdraw.json.data!.ai_consent).toBe(false);
    const { data } = await adminClient().from("household_requests").select("ai_consent, budget").eq("id", draft.id).single();
    expect(data).toEqual({ ai_consent: false, budget: 150000 });
  });
});
