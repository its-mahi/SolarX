import "server-only";
import type { AiCapability, AiProvider, ProviderRequest, ProviderResponse } from "../types";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  const secs = raw === null ? NaN : Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : undefined;
}

/** Thin REST adapter. Never throws for provider failures; never returns provider messages. */
export function createGeminiProvider(opts: {
  apiKey?: string;
  model?: string;
  fetch?: FetchLike;
}): AiProvider {
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  return {
    name: "gemini",
    supports: new Set<AiCapability>(["vision", "document", "text"]),
    isConfigured: () => Boolean(opts.apiKey && opts.model),
    async generate(req: ProviderRequest): Promise<ProviderResponse> {
      const model = req.model || opts.model || "";
      const body = {
        systemInstruction: { parts: [{ text: req.systemInstruction }] },
        contents: [
          {
            role: "user",
            parts: req.parts.map((p) =>
              p.kind === "text"
                ? { text: p.text }
                : { inlineData: { mimeType: p.mimeType, data: toBase64(p.data) } },
            ),
          },
        ],
        generationConfig: {
          temperature: req.temperature,
          responseMimeType: "application/json",
          ...(req.responseJsonSchema ? { responseJsonSchema: req.responseJsonSchema } : {}),
        },
      };
      try {
        const res = await doFetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey ?? "" },
          body: JSON.stringify(body),
          signal: req.signal,
        });
        if (res.status === 429) {
          return { ok: false, kind: "rate_limited", retryAfterMs: parseRetryAfter(res) };
        }
        if (!res.ok) return { ok: false, kind: "provider_error" };
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: unknown }[] } }[];
        };
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
        if (!text) return { ok: false, kind: "provider_error" };
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
