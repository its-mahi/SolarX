import type {
  AiCapability,
  AiProvider,
  AiProviderName,
  ProviderRequest,
  ProviderResponse,
} from "@/lib/ai/types";

export type MockStep =
  | { text: string; delayMs?: number }
  | { json: unknown; delayMs?: number }
  | { fail: "timeout" | "rate_limited" | "provider_error"; retryAfterMs?: number };

export function createMockProvider(opts: {
  name?: AiProviderName;
  supports?: AiCapability[];
  configured?: boolean;
  model?: string;
  steps: MockStep[] | ((req: ProviderRequest, callIndex: number) => MockStep);
}): AiProvider & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  const model = opts.model ?? "mock-model";
  return {
    name: opts.name ?? "gemini",
    supports: new Set<AiCapability>(opts.supports ?? ["vision", "document", "text"]),
    isConfigured: () => opts.configured ?? true,
    calls,
    async generate(req: ProviderRequest): Promise<ProviderResponse> {
      const index = calls.length;
      calls.push(req);
      const step =
        typeof opts.steps === "function"
          ? opts.steps(req, index)
          : (opts.steps[Math.min(index, opts.steps.length - 1)] ?? { fail: "provider_error" as const });
      if ("fail" in step) return { ok: false, kind: step.fail, retryAfterMs: step.retryAfterMs };
      if (step.delayMs) {
        const aborted = await new Promise<boolean>((resolve) => {
          const t = setTimeout(() => resolve(false), step.delayMs);
          req.signal.addEventListener("abort", () => { clearTimeout(t); resolve(true); }, { once: true });
        });
        if (aborted) return { ok: false, kind: "timeout" };
      }
      return { ok: true, text: "json" in step ? JSON.stringify(step.json) : step.text, model };
    },
  };
}
