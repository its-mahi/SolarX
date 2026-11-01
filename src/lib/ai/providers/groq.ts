import "server-only";
import type { AiCapability, AiProvider, ProviderRequest, ProviderResponse } from "../types";
import type { FetchLike } from "./gemini";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/** Optional text-only fallback adapter (plain REST, OpenAI-compatible JSON mode). */
export function createGroqProvider(opts: {
  apiKey?: string;
  model?: string;
  fetch?: FetchLike;
}): AiProvider {
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  return {
    name: "groq",
    supports: new Set<AiCapability>(["text"]),
    isConfigured: () => Boolean(opts.apiKey && opts.model),
    async generate(req: ProviderRequest): Promise<ProviderResponse> {
      const model = req.model || opts.model || "";
      const userText = req.parts.filter((p) => p.kind === "text").map((p) => p.text).join("\n\n");
      try {
        const res = await doFetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey ?? ""}` },
          body: JSON.stringify({
            model,
            temperature: req.temperature,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: req.systemInstruction },
              { role: "user", content: userText },
            ],
          }),
          signal: req.signal,
        });
        if (res.status === 429) {
          const secs = Number(res.headers.get("retry-after"));
          return {
            ok: false,
            kind: "rate_limited",
            retryAfterMs: Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : undefined,
          };
        }
        if (!res.ok) return { ok: false, kind: "provider_error" };
        const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const text = json.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text) return { ok: false, kind: "provider_error" };
        return { ok: true, text, model };
      } catch (err) {
        if (req.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          return { ok: false, kind: "timeout" };
        }
        return { ok: false, kind: "provider_error" };
      }
    },
  };
}
