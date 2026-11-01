// Task service for the advisor explanation (specs/011). The only caller of generateStructured
// for task "advisor_explain". The AI explains stored facts; it never computes them.
import "server-only";
import { generateStructured } from "./client";
import { instructionText, trustedJson, untrustedText } from "./untrusted";
import { advisorExplanationAiOutputSchema, type AdvisorExplanationAiOutput } from "./schemas/advisor-explain";
import { ADVISOR_EXPLAIN_PROMPT_VERSION, ADVISOR_EXPLAIN_SYSTEM_INSTRUCTION } from "./prompts/advisor-explain.v1";
import type { AiInputPart } from "./types";
import { factsForPrompt } from "@/lib/domain/advisor/build-advisor-facts";
import type { AdvisorFacts } from "@/lib/domain/advisor/types";
import type { AdvisorAiStatus } from "@/lib/validation/advisor";

export type AdvisorAiOutcome =
  | { output: AdvisorExplanationAiOutput; aiStatus: "used" }
  | { output: null; aiStatus: Exclude<AdvisorAiStatus, "used" | "rejected"> };

const OVERALL_TIMEOUT_MS = 15_000;

/** Never throws for AI failures. */
export async function explainWithAi(facts: AdvisorFacts, signal?: AbortSignal): Promise<AdvisorAiOutcome> {
  const overall = AbortSignal.timeout(OVERALL_TIMEOUT_MS);
  try {
    const input: AiInputPart[] = [
      instructionText(
        `Explain these results for the household. Mode: ${facts.mode}. Leading quote: ${facts.leadingQuoteLabel ? `Quote ${facts.leadingQuoteLabel}` : "none"}.`,
      ),
      trustedJson(
        "advisor facts",
        factsForPrompt(facts).map(({ id, section, label, value, unit, kind }) => ({ id, section, label, value, unit, kind })),
      ),
    ];
    const lines = Object.entries(facts.roofObservationTexts).map(([id, t]) => `${id}: ${t}`);
    if (lines.length > 0) input.push(untrustedText("roof observations", lines.join("\n"), { maxChars: 4000 }));

    const result = await generateStructured({
      task: "advisor_explain",
      promptVersion: ADVISOR_EXPLAIN_PROMPT_VERSION,
      systemInstruction: ADVISOR_EXPLAIN_SYSTEM_INSTRUCTION,
      capability: "text",
      schema: advisorExplanationAiOutputSchema,
      input,
      timeoutMs: 12_000,
      signal: signal ? AbortSignal.any([signal, overall]) : overall,
    });
    if (result.ok) return { output: result.data, aiStatus: "used" };
    const kind = result.error.kind;
    return { output: null, aiStatus: kind === "not_configured" ? "not_configured" : kind === "invalid_output" ? "invalid_output" : "unavailable" };
  } catch {
    return { output: null, aiStatus: "unavailable" };
  }
}
