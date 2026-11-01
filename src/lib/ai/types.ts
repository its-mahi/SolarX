import "server-only";
import type { z } from "zod";

export type AiTask = "roof_analysis" | "quote_extraction" | "voice_parse" | "advisor_explain";
export type AiCapability = "vision" | "document" | "text";
export type AiProviderName = "gemini" | "groq";
export type AiFileMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export type AiInputPart =
  | { kind: "text"; text: string; trust: "instruction" | "trusted_data" | "untrusted" }
  | { kind: "file"; mimeType: AiFileMimeType; data: Uint8Array; label: string; trust: "untrusted" };

export interface GenerateStructuredOptions<T> {
  task: AiTask;
  promptVersion: string;
  systemInstruction: string;
  input: AiInputPart[];
  schema: z.ZodType<T>;
  responseJsonSchema?: Record<string, unknown>;
  capability: AiCapability;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type AiFailureKind =
  | "not_configured"
  | "unsupported_input"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "invalid_output";

export interface AiFailure {
  kind: AiFailureKind;
  retryable: boolean;
}

export interface AiCallMeta {
  task: AiTask;
  provider: AiProviderName | null;
  model: string | null;
  promptVersion: string;
  attempts: number;
  durationMs: number;
  fellBack: boolean;
}

export type AiResult<T> =
  | { ok: true; data: T; meta: AiCallMeta }
  | { ok: false; error: AiFailure; meta: AiCallMeta };

export interface ProviderRequest {
  model: string;
  systemInstruction: string;
  parts: AiInputPart[];
  responseJsonSchema?: Record<string, unknown>;
  temperature: 0;
  signal: AbortSignal;
}

export type ProviderResponse =
  | { ok: true; text: string; model: string }
  | { ok: false; kind: "timeout" | "rate_limited" | "provider_error"; retryAfterMs?: number };

export interface AiProvider {
  readonly name: AiProviderName;
  readonly supports: ReadonlySet<AiCapability>;
  isConfigured(): boolean;
  generate(req: ProviderRequest): Promise<ProviderResponse>;
}

export interface AiClient {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiResult<T>>;
}
