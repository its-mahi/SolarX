import "server-only";
import { generateStructured } from "./client";
import { instructionText, untrustedFile } from "./untrusted";
import {
  normalizeRoofAnalysis,
  ROOF_ANALYSIS_JSON_SCHEMA,
  RoofAnalysisOutputSchema,
  type NormalizedRoofAnalysis,
} from "./schemas/roof-analysis";
import { ROOF_ANALYSIS_PROMPT_VERSION, ROOF_ANALYSIS_SYSTEM_INSTRUCTION } from "./prompts/roof-analysis.v1";
import type { AiCallMeta, AiFailure, AiFileMimeType } from "./types";

export type RoofAnalysisResult =
  | { ok: true; analysis: NormalizedRoofAnalysis; meta: AiCallMeta }
  | { ok: false; failure: AiFailure; meta: AiCallMeta };

/** Sends only the photo and fixed instructions. Callers verify magic bytes and size first. */
export async function analyzeRoofPhoto(input: {
  bytes: Uint8Array;
  mimeType: Extract<AiFileMimeType, "image/jpeg" | "image/png" | "image/webp">;
}): Promise<RoofAnalysisResult> {
  const result = await generateStructured({
    task: "roof_analysis",
    promptVersion: ROOF_ANALYSIS_PROMPT_VERSION,
    systemInstruction: ROOF_ANALYSIS_SYSTEM_INSTRUCTION,
    capability: "vision",
    schema: RoofAnalysisOutputSchema,
    responseJsonSchema: ROOF_ANALYSIS_JSON_SCHEMA,
    input: [
      instructionText("Analyze the attached roof photo."),
      ...untrustedFile("roof_photo", input.bytes, input.mimeType),
    ],
  });
  if (!result.ok) return { ok: false, failure: result.error, meta: result.meta };
  return { ok: true, analysis: normalizeRoofAnalysis(result.data), meta: result.meta };
}
