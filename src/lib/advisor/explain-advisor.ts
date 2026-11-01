// Orchestrates one advisor explanation (specs/011): facts -> template -> optional AI -> fidelity
// check -> response. Read-only, nothing persisted. AI failures never throw: the template is shown.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { explainWithAi } from "@/lib/ai/advisor-explain";
import { buildAdvisorFacts } from "@/lib/domain/advisor/build-advisor-facts";
import { renderDisclaimers } from "@/lib/domain/advisor/disclaimers";
import { buildTemplateExplanation } from "@/lib/domain/advisor/template-explanation";
import type { AdvisorExplanation, AdvisorInputs, AdvisorValidationIssue, TemplateExplanation } from "@/lib/domain/advisor/types";
import { validateAdvisorExplanation } from "@/lib/domain/advisor/validate-explanation";
import type { RequestRow } from "@/lib/requests/repository";
import type { Database } from "@/lib/supabase/database.types";
import { ADVISOR_SECTION_TITLES, type AdvisorAiStatus, type AdvisorExplanationResponse } from "@/lib/validation/advisor";
import { loadAdvisorInputs } from "./load-advisor-inputs";

export type ExplainResult = { response: AdvisorExplanationResponse; issues: AdvisorValidationIssue[] };

/** Builds the response from already-loaded inputs (used by the route and by tests). */
export async function explainFromInputs(
  requestId: string,
  inputs: AdvisorInputs,
  signal?: AbortSignal,
): Promise<ExplainResult> {
  const facts = buildAdvisorFacts(inputs);
  const template = buildTemplateExplanation(facts);

  let chosen: AdvisorExplanation | TemplateExplanation = template;
  let source: "ai" | "template" = "template";
  let aiStatus: AdvisorAiStatus;
  let issues: AdvisorValidationIssue[] = [];

  const ai = await explainWithAi(facts, signal);
  if (ai.output) {
    const check = validateAdvisorExplanation(ai.output, facts);
    if (check.ok) {
      chosen = ai.output;
      source = "ai";
      aiStatus = "used";
    } else {
      aiStatus = "rejected";
      issues = check.issues;
    }
  } else {
    aiStatus = ai.aiStatus;
  }

  const available = template.available;
  const response: AdvisorExplanationResponse = {
    request_id: requestId,
    generated_at: new Date().toISOString(),
    source,
    ai_status: aiStatus,
    mode: facts.mode,
    sections: {
      observed: { title: ADVISOR_SECTION_TITLES.observed, available: available.observed, summary: chosen.observed.summary, points: chosen.observed.points },
      calculations: { title: ADVISOR_SECTION_TITLES.calculations, available: available.calculations, summary: chosen.calculations.summary, points: chosen.calculations.points },
      recommendation: {
        title: ADVISOR_SECTION_TITLES.recommendation,
        available: available.recommendation,
        summary: chosen.recommendation.summary,
        points: chosen.recommendation.points,
        leading_quote_label: facts.leadingQuoteLabel,
      },
    },
    limitations: chosen.limitations,
    disclaimers: renderDisclaimers(inputs.estimate?.ruleVersion ?? null),
    facts: facts.facts,
    quote_labels: facts.quoteLabels,
  };
  return { response, issues };
}

export async function explainAdvisor(opts: {
  supabase: SupabaseClient<Database>;
  request: RequestRow;
  signal?: AbortSignal;
}): Promise<ExplainResult & { mode: string }> {
  const inputs = await loadAdvisorInputs(opts.supabase, opts.request);
  const result = await explainFromInputs(opts.request.id, inputs, opts.signal);
  return { ...result, mode: result.response.mode };
}
