import "server-only";

/** Overall wall-clock budget for one generateStructured call (all attempts). */
export const AI_TOTAL_BUDGET_MS = 30_000;

export interface AiConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
  timeoutMs: number;
  maxRetries: number;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function opt(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** Reads server-only AI env vars. Never logs values. */
export function readAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    geminiApiKey: opt(env.GEMINI_API_KEY),
    geminiModel: opt(env.GEMINI_MODEL),
    groqApiKey: opt(env.GROQ_API_KEY),
    groqModel: opt(env.GROQ_MODEL),
    timeoutMs: clampInt(env.AI_TIMEOUT_MS, 20_000, 1_000, 25_000),
    maxRetries: clampInt(env.AI_MAX_RETRIES, 1, 0, 2),
  };
}
