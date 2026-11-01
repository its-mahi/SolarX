import "server-only";
import { AI_TOTAL_BUDGET_MS, readAiConfig, type AiConfig } from "./config";
import { extractJsonObject } from "./json";
import { logAiCall } from "./log";
import { PREAMBLE } from "./prompts/preamble";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import type {
  AiCallMeta,
  AiClient,
  AiFailureKind,
  AiProvider,
  AiResult,
  GenerateStructuredOptions,
  ProviderResponse,
} from "./types";

export interface AiClientDeps {
  providers?: AiProvider[];
  config?: Partial<AiConfig>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const MIN_BUDGET_FOR_RETRY_MS = 5_000;
const BASE_BACKOFF_MS = 750;
const RETRYABLE: ReadonlySet<string> = new Set(["timeout", "rate_limited", "provider_error"]);

function defaultProviders(config: AiConfig): AiProvider[] {
  return [
    createGeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel }),
    createGroqProvider({ apiKey: config.groqApiKey, model: config.groqModel }),
  ];
}

export function createAiClient(deps: AiClientDeps = {}): AiClient {
  const config: AiConfig = { ...readAiConfig(), ...deps.config };
  const providers = deps.providers ?? defaultProviders(config);
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;

  function modelFor(p: AiProvider): string {
    return (p.name === "gemini" ? config.geminiModel : config.groqModel) ?? "";
  }

  async function attempt(
    provider: AiProvider,
    opts: GenerateStructuredOptions<unknown>,
    timeoutMs: number,
  ): Promise<ProviderResponse> {
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onCallerAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<ProviderResponse>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ ok: false, kind: "timeout" });
      }, timeoutMs);
    });
    try {
      const call = provider
        .generate({
          model: modelFor(provider),
          systemInstruction: `${PREAMBLE}\n\n${opts.systemInstruction}`,
          parts: opts.input,
          responseJsonSchema: opts.responseJsonSchema,
          temperature: 0,
          signal: controller.signal,
        })
        .catch((): ProviderResponse => ({ ok: false, kind: "provider_error" }));
      return await Promise.race([call, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  async function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiResult<T>> {
    const start = now();
    const meta: AiCallMeta = {
      task: options.task,
      provider: null,
      model: null,
      promptVersion: options.promptVersion,
      attempts: 0,
      durationMs: 0,
      fellBack: false,
    };
    const finish = (kind: AiFailureKind | "ok", data?: T): AiResult<T> => {
      meta.durationMs = Math.max(0, now() - start);
      logAiCall(meta, kind);
      if (kind === "ok") return { ok: true, data: data as T, meta };
      return { ok: false, error: { kind, retryable: kind !== "not_configured" && kind !== "unsupported_input" }, meta };
    };

    const configured = providers.filter((p) => p.isConfigured());
    const candidates = configured.filter((p) => p.supports.has(options.capability));
    if (candidates.length === 0) {
      return finish(configured.length === 0 ? "not_configured" : "unsupported_input");
    }

    const perAttempt = options.timeoutMs ?? config.timeoutMs;
    const remaining = () => AI_TOTAL_BUDGET_MS - (now() - start);
    let lastKind: AiFailureKind = "provider_error";
    let text: string | null = null;

    outer: for (let i = 0; i < candidates.length; i++) {
      const provider = candidates[i];
      const maxAttempts = i === 0 ? 1 + config.maxRetries : 1;
      if (i > 0 && remaining() <= 0) break;
      for (let n = 1; n <= maxAttempts; n++) {
        if (options.signal?.aborted) {
          lastKind = "provider_error";
          break outer;
        }
        meta.attempts += 1;
        meta.provider = provider.name;
        meta.fellBack = i > 0;
        const res = await attempt(provider, options as GenerateStructuredOptions<unknown>, Math.max(1, Math.min(perAttempt, remaining())));
        if (res.ok) {
          meta.model = res.model;
          text = res.text;
          break outer;
        }
        lastKind = res.kind;
        if (!RETRYABLE.has(res.kind) || n === maxAttempts) break;
        if (res.kind === "rate_limited" && (res.retryAfterMs ?? 0) > MIN_BUDGET_FOR_RETRY_MS) break;
        if (remaining() < MIN_BUDGET_FOR_RETRY_MS) break;
        const backoff = BASE_BACKOFF_MS * 2 ** (n - 1) + Math.floor(random() * 250);
        await sleep(Math.max(backoff, res.kind === "rate_limited" ? (res.retryAfterMs ?? 0) : 0));
      }
    }

    if (text === null) return finish(lastKind);
    const json = extractJsonObject(text);
    if (!json.ok) return finish("invalid_output");
    const parsed = options.schema.safeParse(json.value);
    if (!parsed.success) return finish("invalid_output");
    return finish("ok", parsed.data);
  }

  return { generateStructured };
}

let defaultClient: AiClient | null = null;
let testClient: AiClient | null = null;

export function getAiClient(): AiClient {
  if (testClient) return testClient;
  defaultClient ??= createAiClient();
  return defaultClient;
}

export function setAiClientForTests(client: AiClient | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("setAiClientForTests is not available in production");
  }
  testClient = client;
}

export function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiResult<T>> {
  return getAiClient().generateStructured(options);
}
