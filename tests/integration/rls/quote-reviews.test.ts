import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { setupComparisonWorld, teardownComparisonWorld, type ComparisonWorld } from "../../helpers/comparison-world";
import { adminClient, anonClient } from "../../helpers/supabase";

let w: ComparisonWorld;
beforeAll(async () => {
  w = await setupComparisonWorld();
  const res = await apiFetch("/api/quotes/compare", { token: w.owner.accessToken, body: { requestId: w.requestId } });
  expect(res.status).toBe(200);
});
afterAll(() => teardownComparisonWorld(w));

describe("quote_reviews RLS", () => {
  it("owner reads own reviews", async () => {
    const { data } = await w.owner.client.from("quote_reviews").select("id").in("quote_id", w.quoteIds);
    expect(data).toHaveLength(3);
  });
  it("other household, vendors and anon read nothing", async () => {
    for (const client of [w.other.client, w.vendors[0].client, w.vendors[2].client, anonClient()]) {
      const { data } = await client.from("quote_reviews").select("id").in("quote_id", w.quoteIds);
      expect(data ?? []).toHaveLength(0);
    }
  });
  it("nobody can insert, update or delete as an authenticated user, including the owner", async () => {
    const { data: row } = await adminClient().from("quote_reviews").select("*").eq("quote_id", w.quoteIds[0]).single();
    for (const user of [w.owner, w.other, w.vendors[0]]) {
      const ins = await user.client.from("quote_reviews").insert({
        quote_id: w.quoteIds[1], total_score: 100, scoring_version: "x", explanation: "forged",
      });
      expect(ins.error).not.toBeNull();
      await user.client.from("quote_reviews").update({ total_score: 100 }).eq("id", row!.id);
      await user.client.from("quote_reviews").delete().eq("id", row!.id);
    }
    const { data: after } = await adminClient().from("quote_reviews").select("total_score").eq("id", row!.id).single();
    expect(Number(after!.total_score)).toBe(Number(row!.total_score));
    expect((await adminClient().from("quote_reviews").select("id").in("quote_id", w.quoteIds)).data).toHaveLength(3);
  });
});
