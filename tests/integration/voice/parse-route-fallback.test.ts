/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed fakes and JSON bodies */
// Failure fallback for POST /api/voice/parse with the mock AI provider (specs/010 US2).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/voice/parse/route";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createMockProvider } from "../../helpers/mock-ai-provider";

let household: TestUser;
beforeAll(async () => {
  household = await createTestUser({ role: "household" });
});
afterAll(async () => {
  await deleteTestUser(household?.id);
});
afterEach(() => setAiClientForTests(null));

function install(opts: Parameters<typeof createMockProvider>[0]) {
  const mock = createMockProvider(opts);
  setAiClientForTests(createAiClient({ providers: [mock], config: { geminiModel: "m", maxRetries: 0 }, sleep: async () => {} }));
  return mock;
}
async function call(transcript: string) {
  const res = await POST(
    new Request("http://127.0.0.1:3000/api/voice/parse", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${household.accessToken}` },
      body: JSON.stringify({ transcript, language: "en-IN" }),
    }),
    { params: Promise.resolve({}) },
  );
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) as { data?: any; error?: any } };
}

// Rules find units and budget; capacity and bill are left for the AI.
const PARTIAL = "250 units and budget 150000";

describe("AI failure fallback", () => {
  it.each([
    ["provider_error", { fail: "provider_error" as const }],
    ["timeout", { fail: "timeout" as const }],
    ["rate_limited", { fail: "rate_limited" as const }],
  ])("%s keeps rule values with ai_status unavailable", async (_n, step) => {
    install({ steps: [step] });
    const r = await call(PARTIAL);
    expect(r.status).toBe(200);
    expect(r.json.data.ai_status).toBe("unavailable");
    expect(r.json.data.fields.monthly_units).toMatchObject({ status: "heard", value: 250, source: "rules" });
    expect(r.json.data.fields.budget).toMatchObject({ status: "heard", value: 150000, source: "rules" });
  });

  it("not configured -> not_configured with rule values", async () => {
    install({ steps: [{ json: {} }], configured: false });
    const r = await call(PARTIAL);
    expect(r.status).toBe(200);
    expect(r.json.data.ai_status).toBe("not_configured");
    expect(r.json.data.fields.monthly_units.value).toBe(250);
  });

  it.each([
    ["extra key", { json: { monthly_units: 1, monthly_bill: null, budget: null, preferred_capacity_kw: null, issues: [], submit: true } }],
    ["string number", { json: { monthly_units: "250", monthly_bill: null, budget: null, preferred_capacity_kw: null, issues: [] } }],
    ["not json", { text: "sure, here you go" }],
  ])("malformed AI output (%s) -> invalid_output, rules only", async (_n, step) => {
    install({ steps: [step] });
    const r = await call(PARTIAL);
    expect(r.status).toBe(200);
    expect(r.json.data.ai_status).toBe("invalid_output");
    expect(r.json.data.fields.monthly_units).toMatchObject({ status: "heard", source: "rules" });
    expect(r.json.data.fields.preferred_capacity_kw.status).toBe("not_heard");
  });

  it("503 AI_UNAVAILABLE when AI failed and nothing was understood, without provider text", async () => {
    install({ steps: [{ fail: "provider_error" }] });
    const r = await call("hello there how are you");
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe("AI_UNAVAILABLE");
    expect(r.text).not.toMatch(/stack|mock-model|gemini/i);
  });

  it("503 when not configured and nothing was understood", async () => {
    install({ steps: [{ json: {} }], configured: false });
    const r = await call("hello there how are you");
    expect(r.status).toBe(503);
    expect(r.json.error.details[0].reason).toBe("not_configured");
  });

  it("200 empty result when AI worked but nothing was understood", async () => {
    install({ steps: [{ json: { monthly_units: null, monthly_bill: null, budget: null, preferred_capacity_kw: null, issues: [] } }] });
    const r = await call("hello there how are you");
    expect(r.status).toBe(200);
    expect(r.json.data.ai_status).toBe("used");
  });
});
