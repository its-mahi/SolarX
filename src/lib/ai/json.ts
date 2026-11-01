import "server-only";

export type JsonExtraction = { ok: true; value: unknown } | { ok: false };

/** Accepts a single JSON object, optionally wrapped in one Markdown code fence. */
export function extractJsonObject(text: string): JsonExtraction {
  let body = text.trim();
  const fence = /^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n?```$/.exec(body);
  if (fence) body = fence[1].trim();
  if (!body.startsWith("{")) return { ok: false };
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
