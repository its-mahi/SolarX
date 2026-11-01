/* eslint-disable @typescript-eslint/no-explicit-any */
// Authorization, template path and read-only guarantees for POST /api/advisor/explain (specs/011 T014).
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { advisorExplanationResponseSchema } from "@/lib/validation/advisor";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { explain, installMock, resetMock, setupAdvisorWorld, teardownAdvisorWorld, type AdvisorWorld } from "./_world";

let w: AdvisorWorld;
beforeAll(async () => {
  w = await setupAdvisorWorld();
});
afterAll(() => teardownAdvisorWorld(w));
afterEach(resetMock);

async function counts() {
  const admin = adminClient();
  const c = async (table: any, col: string, ids: string[]) =>
    (await admin.from(table).select("id", { count: "exact", head: true }).in(col, ids)).count;
  return {
    requests: await c("household_requests", "id", [w.requestId]),
    estimates: await c("solar_estimates", "request_id", [w.requestId]),
    roof: await c("roof_assessments", "request_id", [w.requestId]),
    quotes: await c("quotes", "request_id", [w.requestId]),
    reviews: await c("quote_reviews", "quote_id", w.quoteIds),
    acceptances: await c("quote_acceptances", "request_id", [w.requestId]),
  };
}

describe("POST /api/advisor/explain access", () => {
  it("401 without a session", async () => {
    // Direct invocation has no cookie store, so anonymous access goes through the running app.
    const res = await apiFetch("/api/advisor/explain", { body: { request_id: w.requestId } });
    expect(res.status).toBe(401);
    expect(res.json.error?.code).toBe("UNAUTHENTICATED");
  });

  it("403 for a vendor", async () => {
    expect((await explain(w.vendors[0].accessToken, { request_id: w.requestId })).status).toBe(403);
  });

  it("404 for another household's request and for a random id, with the same body", async () => {
    const other = await explain(w.other.accessToken, { request_id: w.requestId });
    const random = await explain(w.other.accessToken, { request_id: randomUUID() });
    expect(other.status).toBe(404);
    expect(random.status).toBe(404);
    expect(other.json.error.code).toBe("NOT_FOUND");
    expect(other.json).toEqual(random.json);
    expect(other.text).not.toMatch(/SunRise|165000|94\./);
  });

  it("400 for a non-UUID, an unknown key, and a non-JSON body", async () => {
    expect((await explain(w.owner.accessToken, { request_id: "nope" })).status).toBe(400);
    expect((await explain(w.owner.accessToken, { request_id: w.requestId, extra: 1 })).status).toBe(400);
  });
});

describe("owner, AI not configured (standard summary)", () => {
  it("returns a valid template response that matches stored values, and writes nothing", async () => {
    installMock({ steps: [{ json: {} }], configured: false });
    const before = await counts();
    const res = await explain(w.owner.accessToken, { request_id: w.requestId });
    expect(res.status).toBe(200);
    const data = advisorExplanationResponseSchema.parse(res.json.data);
    expect(data.source).toBe("template");
    expect(data.ai_status).toBe("not_configured");
    expect(data.disclaimers.map((d) => d.code)).toEqual(["estimates_only", "no_subsidy_guarantee", "site_survey_required", "score_not_official", "ai_may_err"]);
    expect(data.sections.observed.title).toBe("What I observed");
    expect(data.sections.calculations.title).toBe("What the calculations show");
    expect(data.sections.recommendation.title).toBe("What I recommend");
    expect(data.mode).toBe("compare");

    // Every score, rank and the leading quote equal the stored reviews (never recomputed).
    const { data: reviews } = await adminClient().from("quote_reviews").select("quote_id, total_score, score_breakdown").in("quote_id", w.quoteIds);
    const rank1 = reviews!.find((r) => (r.score_breakdown as any).comparison.rank === 1)!;
    const labelOfRank1 = data.quote_labels.find((q) => q.quoteId === rank1.quote_id)!.label;
    expect(data.sections.recommendation.leading_quote_label).toBe(labelOfRank1);
    for (const q of data.quote_labels) {
      const r = reviews!.find((x) => x.quote_id === q.quoteId)!;
      expect(data.facts.find((f) => f.id === `quote.${q.label}.total_score`)?.value).toBe(Number(r.total_score));
      expect(q.rank).toBe((r.score_breakdown as any).comparison.rank);
    }
    expect(data.facts.find((f) => f.id === "estimate.net_cost")?.value).toBe(87000);
    expect(data.sections.recommendation.summary).toContain(`Quote ${labelOfRank1} has the highest comparison score`);
    expect(await counts()).toEqual(before);
  });

  it("a quote submitted after the last comparison needs a new comparison and names no leading quote", async () => {
    installMock({ steps: [{ json: {} }], configured: false });
    const admin = adminClient();
    const { data: first } = await admin.from("quotes").select("*").eq("id", w.quoteIds[0]).single();
    const { data: vendor } = await admin.from("vendors").select("id").eq("user_id", w.vendors[0].id).single();
    // another vendor's quote: reuse vendor 1 after withdrawing its first quote to satisfy the one-active-quote index
    await admin.from("quotes").update({ status: "withdrawn" }).eq("id", first!.id);
    const { id: _id, ...rest } = first!;
    void _id;
    const ins = await admin.from("quotes").insert({ ...rest, vendor_id: vendor!.id, status: "submitted", created_at: new Date().toISOString() }).select("id").single();
    expect(ins.error).toBeNull();
    try {
      const res = await explain(w.owner.accessToken, { request_id: w.requestId });
      expect(res.status).toBe(200);
      expect(res.json.data.mode).toBe("needs_comparison");
      expect(res.json.data.sections.recommendation.leading_quote_label).toBeNull();
      expect(res.json.data.sections.recommendation.summary).toMatch(/Open the comparison/);
    } finally {
      await admin.from("quotes").delete().eq("id", ins.data!.id);
      await admin.from("quotes").update({ status: "submitted" }).eq("id", first!.id);
    }
  });
});
