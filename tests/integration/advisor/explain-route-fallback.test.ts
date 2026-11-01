/* eslint-disable @typescript-eslint/no-explicit-any */
// AI path and fallbacks for POST /api/advisor/explain with the mock provider (specs/011 T025).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildAdvisorFacts } from "@/lib/domain/advisor/build-advisor-facts";
import { buildTemplateExplanation } from "@/lib/domain/advisor/template-explanation";
import { loadAdvisorInputs } from "@/lib/advisor/load-advisor-inputs";
import { getOwnRequest } from "@/lib/requests/repository";
import { advisorExplanationResponseSchema } from "@/lib/validation/advisor";
import {
  INJECTED_ROOF_TEXT,
  explain,
  installMock,
  providerText,
  resetMock,
  setupAdvisorWorld,
  teardownAdvisorWorld,
  type AdvisorWorld,
} from "./_world";

let w: AdvisorWorld;
let valid: any; // a real, valid AI output built from the stored facts (the template always validates)
let labels: string[];
let leading: string;

beforeAll(async () => {
  w = await setupAdvisorWorld();
  const row = await getOwnRequest(w.owner.client, w.requestId);
  const facts = buildAdvisorFacts(await loadAdvisorInputs(w.owner.client, row!));
  const { available: _a, ...rest } = buildTemplateExplanation(facts);
  void _a;
  valid = rest;
  // The template echoes stored roof text (untrusted, here containing a planted instruction); an AI output must not.
  valid.observed = {
    summary: "One photo shows a water tank and a staircase room.",
    points: [{ text: "A water tank may shade part of the roof.", fact_refs: ["roof.observation.0.object"] }],
  };
  labels = facts.quoteLabels.map((q) => q.label);
  leading = facts.leadingQuoteLabel!;
});
afterAll(() => teardownAdvisorWorld(w));
afterEach(resetMock);

const call = () => explain(w.owner.accessToken, { request_id: w.requestId });
const clone = () => structuredClone(valid);
const SECRET = /stack|mock-model|gemini|groq|SELECT |postgres/i;

describe("AI used", () => {
  it("valid AI output is shown with source ai", async () => {
    installMock({ steps: [{ json: valid }] });
    const r = await call();
    expect(r.status).toBe(200);
    const data = advisorExplanationResponseSchema.parse(r.json.data);
    expect(data.source).toBe("ai");
    expect(data.ai_status).toBe("used");
    expect(data.sections.recommendation.summary).toBe(valid.recommendation.summary);
    expect(data.disclaimers).toHaveLength(5);
  });
});

describe("AI failure falls back to the standard summary (never 503)", () => {
  it.each([
    ["provider_error", { fail: "provider_error" as const }, "unavailable"],
    ["timeout", { fail: "timeout" as const }, "unavailable"],
    ["rate_limited", { fail: "rate_limited" as const }, "unavailable"],
  ])("%s", async (_n, step, status) => {
    installMock({ steps: [step] });
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.json.data.source).toBe("template");
    expect(r.json.data.ai_status).toBe(status);
    expect(r.json.data.sections.observed.title).toBe("What I observed");
    expect(r.text).not.toMatch(SECRET);
  });

  it("not configured", async () => {
    installMock({ steps: [{ json: {} }], configured: false });
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ source: "template", ai_status: "not_configured" });
  });

  it.each([
    ["non-JSON text", { text: "sure, here is the advice" }],
    ["extra key", { json: { ...valid, rank_override: "A" } }],
    ["missing section", { json: { observed: valid?.observed } }],
  ])("malformed output (%s) -> invalid_output", async (_n, step) => {
    installMock({ steps: [step as any] });
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ source: "template", ai_status: "invalid_output" });
    expect(r.text).not.toMatch(/sure, here is|rank_override/);
  });
});

describe("faulty AI explanations are rejected", () => {
  const otherLabel = () => labels.find((l) => l !== leading)!;
  const faults: [string, (e: any) => void][] = [
    ["wrong leading label", (e) => { e.recommendation.leading_quote_label = otherLabel(); }],
    ["summary names another quote", (e) => { e.recommendation.summary = `Quote ${otherLabel()} is the one to choose.`; }],
    ["wrong amount", (e) => { e.calculations.summary += " Net cost is ₹12,345."; }],
    ["invented label", (e) => { e.recommendation.points[0].text = "Quote Z looks fine."; }],
    ["guarantee claim", (e) => { e.limitations.push("Your subsidy is guaranteed."); }],
    ["verified vendor", (e) => { e.limitations.push("Every vendor here is a verified vendor."); }],
    ["spelled-out amount", (e) => { e.calculations.summary = "It costs about one lakh rupees."; }],
    ["unknown fact ref", (e) => { e.calculations.points[0].fact_refs = ["estimate.magic"]; }],
  ];
  it.each(faults)("%s", async (_n, mutate) => {
    const bad = clone();
    mutate(bad);
    installMock({ steps: [{ json: bad }] });
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ source: "template", ai_status: "rejected" });
    expect(r.json.data.sections.recommendation.leading_quote_label).toBe(leading);
    expect(r.text).not.toMatch(/12,345|one lakh rupees|estimate\.magic|Quote Z|verified vendor|Your subsidy is guaranteed/);
  });
});

describe("what the provider receives", () => {
  it("has labelled facts, roof text only as untrusted data, and no names or personal data", async () => {
    const mock = installMock({ steps: [{ json: valid }] });
    await call();
    const sent = providerText(mock);
    expect(sent).toContain("APPLICATION_DATA");
    expect(sent).toContain("Explain these results");
    expect(sent).toContain(`Leading quote: Quote ${leading}`);
    // vendor names, household details, request/user ids, vendor free text
    for (const secret of ["SunRise Test", "GreenVolt Test", "SolarTech Test", "Plot 12", "Test Locality", "Test household", w.owner.id, w.requestId]) {
      expect(sent).not.toContain(secret);
    }
    // roof observation text only inside the untrusted block
    const untrusted = sent.match(/<<<UNTRUSTED_DATA id=[\s\S]*?<<<END_UNTRUSTED_DATA id=\w+>>>/)?.[0] ?? "";
    expect(untrusted).toContain(INJECTED_ROOF_TEXT);
    expect(sent.replace(untrusted, "")).not.toContain(INJECTED_ROOF_TEXT);
    const trusted = sent.match(/<<<APPLICATION_DATA label[\s\S]*?<<<END_APPLICATION_DATA>>>/)?.[0] ?? "";
    expect(trusted).not.toContain("water tank");
  });

  it("instruction-like roof text cannot change the leading quote or numbers", async () => {
    installMock({ steps: [{ json: valid }] });
    const r = await call();
    expect(r.json.data.sections.recommendation.leading_quote_label).toBe(leading);
    expect(r.json.data.facts.find((f: any) => f.id === "estimate.net_cost").value).toBe(87000);
  });
});
