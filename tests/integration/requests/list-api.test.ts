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

describe("GET /api/requests", () => {
  it("returns an empty list for a new household", async () => {
    const res = await apiFetch<{ items: RequestDto[] }>("/api/requests", { token: user.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ items: [] });
  });

  it("lists own requests newest first with the right next action per status", async () => {
    const admin = adminClient();
    const ids: string[] = [];
    ids.push((await createDraftViaApi(user.accessToken)).id);
    for (let i = 0; i < 4; i++) {
      const r = await completeDraft(user.accessToken);
      await publishViaApi(user.accessToken, r.id);
      ids.push(r.id);
    }
    await admin.from("household_requests").update({ status: "quoted" }).eq("id", ids[2]);
    await admin.from("household_requests").update({ status: "accepted" }).eq("id", ids[3]);
    await admin.from("household_requests").update({ status: "accepted" }).eq("id", ids[4]);
    await admin.from("household_requests").update({ status: "closed" }).eq("id", ids[4]);

    const res = await apiFetch<{ items: RequestDto[] }>("/api/requests", { token: user.accessToken });
    const items = res.json.data!.items;
    expect(items.map((i) => i.id)).toEqual([...ids].reverse());
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(ids[0])!.next_action.kind).toBe("continue");
    expect(byId.get(ids[1])!.next_action.kind).toBe("wait");
    expect(byId.get(ids[2])!.next_action.kind).toBe("compare");
    expect(byId.get(ids[3])!.next_action.kind).toBe("next_steps");
    expect(byId.get(ids[4])!.next_action.kind).toBe("view");
    for (const item of items) expect(item.roof_photo_url).toBeNull();
  });
});
