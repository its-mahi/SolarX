import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { PREAMBLE } from "@/lib/ai/prompts/preamble";
import { aiFailureToApiError } from "@/lib/ai/errors";
import { instructionText, untrustedText } from "@/lib/ai/untrusted";
import type { GenerateStructuredOptions } from "@/lib/ai/types";
import { createMockProvider } from "../../helpers/mock-ai-provider";

const schema = z.object({ n: z.number() });
const SECRET_INPUT = "TOP-SECRET-INPUT-TEXT";
const opts = (over: Partial<GenerateStructuredOptions<{ n: number }>> = {}): GenerateStructuredOptions<{ n: number }> => ({
  task: "voice_parse",
  promptVersion: "t.v1",
  systemInstruction: "TASK INSTR",
  input: [instructionText("go"), untrustedText("x", SECRET_INPUT)],
  schema,
  capability: "text",
  ...over,
});
const sleeps: number[] = [];
const mk = (providers: ReturnType<typeof createMockProvider>[], extra = {}) =>
  createAiClient({
    providers,
    config: { geminiModel: "gm", groqModel: "qm", timeoutMs: 1000, maxRetries: 1 },
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0,
    ...extra,
  });

afterEach(() => {
  sleeps.length = 0;
  vi.restoreAllMocks();
});

describe("generateStructured", () => {
  it("returns validated data with meta", async () => {
    const p = createMockProvider({ steps: [{ json: { n: 1 } }] });
    const r = await mk([p]).generateStructured(opts());
    expect(r).toMatchObject({ ok: true, data: { n: 1 }, meta: { provider: "gemini", model: "mock-model", promptVersion: "t.v1", attempts: 1, fellBack: false } });
    expect(p.calls[0].systemInstruction).toBe(`${PREAMBLE}\n\nTASK INSTR`);
    expect(p.calls[0].temperature).toBe(0);
    expect(p.calls[0].model).toBe("gm");
  });

  it("retries timeout once then returns timeout", async () => {
    const p = createMockProvider({ steps: [{ fail: "timeout" }] });
    const r = await mk([p]).generateStructured(opts());
    expect(r).toMatchObject({ ok: false, error: { kind: "timeout", retryable: true }, meta: { attempts: 2 } });
    expect(sleeps).toEqual([750]);
  });

  it("retries provider_error and succeeds", async () => {
    const p = createMockProvider({ steps: [{ fail: "provider_error" }, { json: { n: 2 } }] });
    const r = await mk([p]).generateStructured(opts());
    expect(r).toMatchObject({ ok: true, meta: { attempts: 2 } });
  });

  it("does not retry long rate limits", async () => {
    const p = createMockProvider({ steps: [{ fail: "rate_limited", retryAfterMs: 9000 }] });
    const r = await mk([p]).generateStructured(opts());
    expect(r).toMatchObject({ ok: false, error: { kind: "rate_limited" }, meta: { attempts: 1 } });
  });

  it("never retries invalid_output", async () => {
    for (const step of [{ text: "not json" }, { json: { n: "x" } }]) {
      const p = createMockProvider({ steps: [step] });
      const r = await mk([p]).generateStructured(opts());
      expect(r).toMatchObject({ ok: false, error: { kind: "invalid_output" }, meta: { attempts: 1 } });
      expect(p.calls).toHaveLength(1);
    }
  });

  it("not_configured with zero attempts; unsupported_input when incapable", async () => {
    const p = createMockProvider({ configured: false, steps: [{ json: { n: 1 } }] });
    expect(await mk([p]).generateStructured(opts())).toMatchObject({ ok: false, error: { kind: "not_configured", retryable: false }, meta: { attempts: 0 } });
    expect(p.calls).toHaveLength(0);
    const t = createMockProvider({ supports: ["text"], steps: [{ json: { n: 1 } }] });
    expect(await mk([t]).generateStructured(opts({ capability: "vision" }))).toMatchObject({ ok: false, error: { kind: "unsupported_input" } });
  });

  it("stops retrying when the 30 s budget is nearly spent", async () => {
    let t = 0;
    const p = createMockProvider({ steps: [{ fail: "timeout" }] });
    const client = mk([p], { now: () => (t += 13_000) });
    const r = await client.generateStructured(opts());
    expect(r).toMatchObject({ ok: false, meta: { attempts: 1 } });
  });

  it("aborts a slow provider at the per-attempt timeout", async () => {
    const p = createMockProvider({ steps: [{ json: { n: 1 }, delayMs: 5000 }] });
    const client = createAiClient({ providers: [p], config: { geminiModel: "m", timeoutMs: 20, maxRetries: 0 } });
    const r = await client.generateStructured(opts());
    expect(r).toMatchObject({ ok: false, error: { kind: "timeout" } });
  });

  it("falls back to groq only for text", async () => {
    const g = createMockProvider({ steps: [{ fail: "provider_error" }] });
    const q = createMockProvider({ name: "groq", supports: ["text"], steps: [{ json: { n: 3 } }] });
    const r = await mk([g, q]).generateStructured(opts());
    expect(r).toMatchObject({ ok: true, data: { n: 3 }, meta: { provider: "groq", fellBack: true, attempts: 3 } });
    expect(q.calls).toHaveLength(1);
    const q2 = createMockProvider({ name: "groq", supports: ["text"], steps: [{ json: { n: 3 } }] });
    const g2 = createMockProvider({ steps: [{ fail: "provider_error" }] });
    for (const capability of ["vision", "document"] as const) {
      const r2 = await mk([g2, q2]).generateStructured(opts({ capability }));
      expect(r2.ok).toBe(false);
    }
    expect(q2.calls).toHaveLength(0);
    const q3 = createMockProvider({ name: "groq", supports: ["text"], configured: false, steps: [{ json: { n: 3 } }] });
    const r3 = await mk([createMockProvider({ steps: [{ fail: "provider_error" }] }), q3]).generateStructured(opts());
    expect(r3).toMatchObject({ ok: false, error: { kind: "provider_error" } });
  });

  it("logs metadata only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mk([createMockProvider({ steps: [{ text: "OUTPUT-SECRET" }] })]).generateStructured(opts());
    await mk([createMockProvider({ steps: [{ json: { n: 1 } }] })]).generateStructured(opts());
    const logged = [...info.mock.calls, ...warn.mock.calls].flat().join("\n");
    expect(logged).toContain("voice_parse");
    expect(logged).not.toContain(SECRET_INPUT);
    expect(logged).not.toContain("OUTPUT-SECRET");
  });
});

describe("helpers", () => {
  it("setAiClientForTests throws in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => setAiClientForTests(null)).toThrow();
    vi.unstubAllEnvs();
  });

  it("aiFailureToApiError builds AI_UNAVAILABLE without provider text", () => {
    const e = aiFailureToApiError({ kind: "timeout", retryable: true }, "Analysis unavailable — retry");
    expect(e).toMatchObject({ code: "AI_UNAVAILABLE", message: "Analysis unavailable — retry" });
    expect(e.details[0]).toMatchObject({ reason: "timeout", retryable: true });
  });
});
