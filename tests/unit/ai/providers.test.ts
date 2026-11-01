import { describe, expect, it } from "vitest";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createGroqProvider } from "@/lib/ai/providers/groq";
import { detectFileType } from "@/lib/validation/file-signature";
import type { ProviderRequest } from "@/lib/ai/types";

const req = (): ProviderRequest => ({
  model: "m", systemInstruction: "s", temperature: 0, signal: new AbortController().signal,
  parts: [{ kind: "text", text: "hi", trust: "instruction" }, { kind: "file", mimeType: "image/png", data: new Uint8Array([1, 2]), label: "p", trust: "untrusted" }],
});
const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe("provider adapters (mocked fetch)", () => {
  it("gemini success, inline file, key in header only", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const p = createGeminiProvider({ apiKey: "K", model: "m", fetch: async (url, init) => { seen = { url, init }; return res(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }); } });
    expect(await p.generate(req())).toEqual({ ok: true, text: '{"a":1}', model: "m" });
    expect(seen!.url).not.toContain("K");
    expect(String(seen!.init.body)).toContain("inlineData");
  });

  it("maps failures without provider text", async () => {
    const mk = (r: () => Response | Promise<Response>) => createGeminiProvider({ apiKey: "K", model: "m", fetch: async () => r() });
    expect(await mk(() => res(429, {}, { "retry-after": "2" })).generate(req())).toEqual({ ok: false, kind: "rate_limited", retryAfterMs: 2000 });
    expect(await mk(() => res(500, { error: "secret" })).generate(req())).toEqual({ ok: false, kind: "provider_error" });
    expect(await mk(() => { throw new TypeError("net"); }).generate(req())).toEqual({ ok: false, kind: "provider_error" });
    expect(await mk(() => res(200, { candidates: [] })).generate(req())).toEqual({ ok: false, kind: "provider_error" });
    const c = new AbortController(); c.abort();
    const abortP = createGeminiProvider({ apiKey: "K", model: "m", fetch: async () => { throw new DOMException("x", "AbortError"); } });
    expect(await abortP.generate({ ...req(), signal: c.signal })).toEqual({ ok: false, kind: "timeout" });
  });

  it("isConfigured needs key and model; groq is text-only", async () => {
    expect(createGeminiProvider({ apiKey: "K" }).isConfigured()).toBe(false);
    const g = createGroqProvider({ apiKey: "K", model: "m", fetch: async () => res(200, { choices: [{ message: { content: "{}" } }] }) });
    expect(g.isConfigured()).toBe(true);
    expect([...g.supports]).toEqual(["text"]);
    expect(await g.generate(req())).toEqual({ ok: true, text: "{}", model: "m" });
  });
});

describe("detectFileType", () => {
  it("detects by magic bytes", () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectFileType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFileType(new TextEncoder().encode("hello world!"))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});
