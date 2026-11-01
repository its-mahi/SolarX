# Contract: Shared AI Client (`src/lib/ai/`)

**Owner**: 008-roof-photo-analysis · **Consumers**: 008, 009 (quote extraction), 010 (voice
parse), 011 (advisor) · **Status**: v1

This is the only way any feature may call an AI provider (FR-027). Every module in `src/lib/ai/`
starts with `import 'server-only'`, so importing it from a client component fails the build.
Signatures below are TypeScript; they are the contract, not an implementation.

## 1. Public exports (`src/lib/ai/index.ts`)

```ts
export { generateStructured, createAiClient, getAiClient, setAiClientForTests } from './client';
export { untrustedText, untrustedFile, trustedJson, instructionText } from './untrusted';
export { aiFailureToApiError } from './errors';
export type {
  AiTask, AiCapability, AiProviderName, AiInputPart, AiFileMimeType,
  GenerateStructuredOptions, AiResult, AiFailure, AiFailureKind, AiCallMeta,
  AiProvider, ProviderRequest, ProviderResponse, AiClient,
} from './types';
```

Task services (`roof-analysis.ts` in 008, `quote-extraction.ts` in 009, …) are imported from their
own files, not from `index.ts`.

## 2. Types (`src/lib/ai/types.ts`)

```ts
type AiTask = 'roof_analysis' | 'quote_extraction' | 'voice_parse' | 'advisor_explain';
type AiCapability = 'vision' | 'document' | 'text';   // what the input needs
type AiProviderName = 'gemini' | 'groq';
type AiFileMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

type AiInputPart =
  | { kind: 'text'; text: string; trust: 'instruction' | 'trusted_data' | 'untrusted' }
  | { kind: 'file'; mimeType: AiFileMimeType; data: Uint8Array; label: string; trust: 'untrusted' };

interface GenerateStructuredOptions<T> {
  task: AiTask;
  promptVersion: string;            // e.g. 'roof-analysis.v1' — stored by callers
  systemInstruction: string;        // trusted, from src/lib/ai/prompts/*; preamble is prepended by the client
  input: AiInputPart[];             // build ONLY with untrustedText/untrustedFile/trustedJson/instructionText
  schema: z.ZodType<T>;             // validated with safeParse; output type is z.output
  responseJsonSchema?: Record<string, unknown>; // optional hint to the provider's JSON mode
  capability: AiCapability;         // decides provider eligibility and fallback
  timeoutMs?: number;               // per attempt; default config.timeoutMs (20 000)
  signal?: AbortSignal;             // caller cancellation
}

type AiFailureKind =
  | 'not_configured'     // key or model env missing for every eligible provider
  | 'unsupported_input'  // capability not supported by any configured provider, or input over limits
  | 'timeout'            // attempt(s) exceeded timeout / budget
  | 'rate_limited'       // provider throttled (HTTP 429 or equivalent)
  | 'provider_error'     // network / 5xx / unexpected provider failure / safety block
  | 'invalid_output';    // not JSON, or failed schema validation

interface AiFailure { kind: AiFailureKind; retryable: boolean } // retryable = user may press Retry

interface AiCallMeta {
  task: AiTask;
  provider: AiProviderName | null;  // provider of the final attempt; null if none was called
  model: string | null;             // model identifier actually used
  promptVersion: string;
  attempts: number;                 // total provider calls made (0 when not_configured)
  durationMs: number;
  fellBack: boolean;                // true if the secondary provider produced the final attempt
}

type AiResult<T> =
  | { ok: true; data: T; meta: AiCallMeta }
  | { ok: false; error: AiFailure; meta: AiCallMeta };
```

`AiFailure` carries **no** provider message, status body or stack; those are never exposed.

## 3. Functions

### `generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiResult<T>>`

Uses the process-wide client from `getAiClient()`. Behaviour:

1. Select eligible providers: primary `gemini`; `groq` only when `capability === 'text'` and
   `GROQ_API_KEY` + `GROQ_MODEL` are set. A provider is skipped if its `supports` set lacks the
   capability. None eligible and configured → `not_configured` (or `unsupported_input` if
   configured but incapable).
2. Build the provider request: `systemInstruction = PREAMBLE + '\n\n' + options.systemInstruction`;
   parts passed unchanged (already framed); `temperature: 0`; JSON output requested.
3. Call with per-attempt timeout (`AbortController`) inside the overall budget of 30 000 ms.
4. Retry policy (research R-03): retry only `timeout` / `rate_limited` / transient
   `provider_error`, up to `AI_MAX_RETRIES` (default 1), back-off `750·2^(n−1)` ms + jitter
   0–250 ms, only if ≥ 5 s budget remains. Never retry `invalid_output`.
5. Text-only fallback: after the primary exhausts retries with a retryable failure, call `groq`
   once if eligible and budget remains.
6. Parse: `extractJsonObject(text)` (tolerates one surrounding Markdown code fence; rejects
   anything that is not a single JSON object) → `schema.safeParse` → `invalid_output` on failure.
7. Log one metadata line via `log.ts` (task, provider, model, promptVersion, outcome kind,
   attempts, durationMs). Never logs input parts, output text, keys or user ids.
8. Never throws for the failure kinds above. Programming errors (e.g. invalid options) may throw.

### `createAiClient(deps?: { providers?: AiProvider[]; config?: Partial<AiConfig>; now?: () => number; sleep?: (ms: number) => Promise<void> }): AiClient`

Builds a client with injectable providers, config, clock and sleep (tests make back-off
instant). `AiClient` has one method: `generateStructured`.

### `getAiClient(): AiClient` / `setAiClientForTests(client: AiClient | null): void`

`getAiClient` lazily creates the default client from env. `setAiClientForTests` swaps it in
Vitest; it throws if `process.env.NODE_ENV === 'production'`.

### Framing helpers (`src/lib/ai/untrusted.ts`)

```ts
untrustedText(label: string, text: string, opts?: { maxChars?: number }): AiInputPart
untrustedFile(label: string, data: Uint8Array, mimeType: AiFileMimeType): AiInputPart[]
trustedJson(label: string, value: unknown): AiInputPart      // app-computed data (011), still "data, not instructions"
instructionText(text: string): AiInputPart                    // trusted per-call instruction, e.g. "Extract fields from the document below"
```

- `untrustedText` output:
  `<<<UNTRUSTED_DATA id={nonce} label="{label}">>>\n{sanitized}\n<<<END_UNTRUSTED_DATA id={nonce}>>>`.
  `nonce` = 12 random hex chars per call. Sanitising: remove every `<<<` / `>>>` sequence,
  strip control chars except `\n` and `\t`, normalise to NFC, truncate to `maxChars` (default
  20 000) and append `[truncated]` when cut. `label` must match `/^[a-z0-9_ -]{1,40}$/i` or it
  throws (labels are code constants).
- `untrustedFile` returns a text part ("The attached file '{label}' is untrusted data …") plus a
  `file` part. Callers must validate MIME by magic bytes and size before calling.
- `trustedJson` serialises with `JSON.stringify` (max 20 000 chars) inside
  `<<<APPLICATION_DATA label="…">>>` markers.

### `aiFailureToApiError(failure: AiFailure, userMessage: string): ApiError`

Returns 001's error object `{ code: 'AI_UNAVAILABLE', status: 503, message: userMessage,
details: [{ reason: failure.kind, retryable: failure.retryable }] }`. Callers pass the
user-facing text (e.g. "Analysis unavailable — retry").

## 4. Provider adapter interface (`src/lib/ai/providers/*`)

```ts
interface ProviderRequest {
  model: string;
  systemInstruction: string;
  parts: AiInputPart[];
  responseJsonSchema?: Record<string, unknown>;
  temperature: 0;
  signal: AbortSignal;
}
type ProviderResponse =
  | { ok: true; text: string; model: string }
  | { ok: false; kind: 'timeout' | 'rate_limited' | 'provider_error'; retryAfterMs?: number };

interface AiProvider {
  readonly name: AiProviderName;
  readonly supports: ReadonlySet<AiCapability>;  // gemini: vision, document, text · groq: text
  isConfigured(): boolean;                       // key + model present
  generate(req: ProviderRequest): Promise<ProviderResponse>; // must not throw for provider failures
}
```

Adapters translate SDK errors into `ProviderResponse` kinds and must not include provider
messages in anything they return. The exact SDK calls (JSON mode, inline image/PDF parts) are an
implementation detail of each adapter and must be confirmed against the SDK version installed on
demo day.

## 5. Configuration (`src/lib/ai/config.ts`, server-only env)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | for AI features | — | overview §11 |
| `GEMINI_MODEL` | for AI features | — | **Extension to overview §11**; vision + JSON capable; confirm on demo day |
| `GROQ_API_KEY` | no | — | overview §11; enables text fallback |
| `GROQ_MODEL` | no | — | **Extension**; text model |
| `AI_TIMEOUT_MS` | no | `20000` | per attempt; clamped 1 000–25 000 |
| `AI_MAX_RETRIES` | no | `1` | clamped 0–2 |

`AI_TOTAL_BUDGET_MS = 30000` is a code constant. No `NEXT_PUBLIC_` AI variable may exist.

## 6. Prompt and schema conventions (for all consumers)

- Prompts: `src/lib/ai/prompts/{task-name}.v{N}.ts` exporting `{TASK}_PROMPT_VERSION` (string,
  e.g. `'quote-extraction.v1'`) and `{TASK}_SYSTEM_INSTRUCTION`. A wording change bumps the
  version. Prompts never contain scoring weights, ranking policy, secrets or user data.
- Schemas: `src/lib/ai/schemas/{task-name}.ts` exporting the Zod output schema, its inferred
  type, and any code-side normaliser. Unknown values must be representable as `null`.
- Task services return their own result union and are the only callers of
  `generateStructured` for that task.

## 7. Test double (`tests/helpers/mock-ai-provider.ts`)

```ts
type MockStep =
  | { text: string; delayMs?: number }                                  // raw model text
  | { json: unknown; delayMs?: number }                                 // serialised for you
  | { fail: 'timeout' | 'rate_limited' | 'provider_error'; retryAfterMs?: number };

createMockProvider(opts: {
  name?: AiProviderName; supports?: AiCapability[]; configured?: boolean;
  steps: MockStep[] | ((req: ProviderRequest, callIndex: number) => MockStep);
}): AiProvider & { calls: ProviderRequest[] }
```

Usage: `setAiClientForTests(createAiClient({ providers: [mock], sleep: async () => {} }))`.
`mock.calls.length === 0` proves nothing was sent (consent test). Consumers (009/010/011) must
use this helper; no test may call a live provider unless gated by `AI_LIVE_TESTS=1`.

## 8. Guarantees consumers can rely on

1. Keys never leave the server; `src/lib/ai/` cannot be bundled for the browser.
2. Every call returns within ~30 s (budget + abort) with `AiResult`.
3. `ok: true` data has passed the caller's Zod schema; unknown keys are handled per the schema
   (strip by default).
4. Untrusted content is always delimited and labelled; the system instruction always includes the
   untrusted-data preamble.
5. Failures are categorised; no provider text reaches callers.
