/**
 * Shared AI client (feature 008). The only way any feature may call an AI provider.
 * Contract: specs/008-roof-photo-analysis/contracts/ai-client.md
 * Conventions (§6): prompts live in src/lib/ai/prompts/{task}.v{N}.ts exporting
 * {TASK}_PROMPT_VERSION and {TASK}_SYSTEM_INSTRUCTION; Zod output schemas live in
 * src/lib/ai/schemas/{task}.ts. Task services import from their own files, not from here.
 */
import "server-only";

export { generateStructured, createAiClient, getAiClient, setAiClientForTests } from "./client";
export { untrustedText, untrustedFile, trustedJson, instructionText } from "./untrusted";
export { aiFailureToApiError } from "./errors";
export type {
  AiTask,
  AiCapability,
  AiProviderName,
  AiInputPart,
  AiFileMimeType,
  GenerateStructuredOptions,
  AiResult,
  AiFailure,
  AiFailureKind,
  AiCallMeta,
  AiProvider,
  ProviderRequest,
  ProviderResponse,
  AiClient,
} from "./types";
