// quote_acceptances RLS and constraints (specs/007 T005).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { acceptBody, createWorld, seedRequest, type AcceptanceWorld } from "../../helpers/acceptance";
import { apiFetch } from "../../helpers/api";

let w: AcceptanceWorld;
let other: TestUser;
let requestId: string, quoteIds: string[];

beforeAll(async () => {
  w = await createWorld(2);
  other = await createTestUser({ role: "household" });
  ({ requestId, quoteIds } = await seedRequest(w, { status: "quoted" }));
  const r = await apiFetch(`/api/quotes/${quoteIds[0]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
  expect(r.status).toBe(200);
});
afterAll(async () => {
  await w.cleanup();
  await deleteTestUser(other?.id);
});

describe("quote_acceptances RLS", () => {
  it("owner and accepted vendor can select; others, rejected vendor and anon cannot", async () => {
    for (const c of [w.household.client, w.vendors[0].client]) {
      const { data } = await c.from("quote_acceptances").select("id").eq("request_id", requestId);
      expect(data).toHaveLength(1);
    }
    for (const c of [w.vendors[1].client, other.client, anonClient()]) {
      const { data } = await c.from("quote_acceptances").select("id").eq("request_id", requestId);
      expect(data ?? []).toEqual([]);
    }
  });

  it("denies INSERT/UPDATE/DELETE to authenticated users, including the owner", async () => {
    const { requestId: r2, quoteIds: q2 } = await seedRequest(w, { status: "quoted", vendorIdx: [0] });
    const ins = await w.household.client
      .from("quote_acceptances")
      .insert({ quote_id: q2[0], request_id: r2, household_id: w.household.id });
    expect(ins.error).not.toBeNull();
    const up = await w.household.client.from("quote_acceptances").update({ accepted_at: "2020-01-01" }).eq("request_id", requestId).select();
    expect(up.data ?? []).toEqual([]);
    const del = await w.household.client.from("quote_acceptances").delete().eq("request_id", requestId).select();
    expect(del.data ?? []).toEqual([]);
    expect((await adminClient().from("quote_acceptances").select("id").eq("request_id", requestId)).data).toHaveLength(1);
    expect((await adminClient().from("quote_acceptances").select("id").eq("request_id", r2)).data).toEqual([]);
  });

  it("service-role duplicates fail with 23505 on request_id and on quote_id", async () => {
    const dupReq = await adminClient()
      .from("quote_acceptances")
      .insert({ quote_id: quoteIds[1], request_id: requestId, household_id: w.household.id });
    expect(dupReq.error?.code).toBe("23505");
    const { requestId: r2 } = await seedRequest(w, { status: "quoted", vendorIdx: [0] });
    const dupQuote = await adminClient()
      .from("quote_acceptances")
      .insert({ quote_id: quoteIds[0], request_id: r2, household_id: w.household.id });
    expect(dupQuote.error?.code).toBe("23505");
  });
});
