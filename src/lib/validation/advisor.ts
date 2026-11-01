// Zod schemas for POST /api/advisor/explain (specs/011 data-model §3, §5).
import { z } from "zod";
import { ADVISOR_DISCLAIMER_CODES } from "@/lib/domain/advisor/disclaimers";

export const advisorExplainRequestSchema = z.strictObject({ request_id: z.string().uuid() });
export type AdvisorExplainRequest = z.infer<typeof advisorExplainRequestSchema>;

export const ADVISOR_SECTION_TITLES = {
  observed: "What I observed",
  calculations: "What the calculations show",
  recommendation: "What I recommend",
} as const;

const point = z.object({ text: z.string(), fact_refs: z.array(z.string()) });
const section = <T extends string>(title: T) =>
  z.object({ title: z.literal(title), available: z.boolean(), summary: z.string(), points: z.array(point) });

const factSchema = z.object({
  id: z.string(),
  section: z.enum(["observed", "calculations", "recommendation"]),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: z
    .enum(["inr", "inr_per_year", "kw", "kwh_per_month", "kwh_per_year", "inr_per_kwh", "kwh_per_kw_year", "years", "days", "points", "count"])
    .nullable(),
  kind: z.enum(["household_input", "estimate", "vendor_stated", "score", "roof_observation", "status"]),
});

export const advisorAiStatusSchema = z.enum(["used", "rejected", "invalid_output", "unavailable", "not_configured"]);
export type AdvisorAiStatus = z.infer<typeof advisorAiStatusSchema>;

export const advisorExplanationResponseSchema = z
  .object({
    request_id: z.string().uuid(),
    generated_at: z.string(),
    source: z.enum(["ai", "template"]),
    ai_status: advisorAiStatusSchema,
    mode: z.enum(["no_data", "no_quotes", "needs_comparison", "compare", "accepted"]),
    sections: z.object({
      observed: section(ADVISOR_SECTION_TITLES.observed),
      calculations: section(ADVISOR_SECTION_TITLES.calculations),
      recommendation: section(ADVISOR_SECTION_TITLES.recommendation).extend({ leading_quote_label: z.string().nullable() }),
    }),
    limitations: z.array(z.string()),
    disclaimers: z
      .array(z.object({ code: z.enum(["estimates_only", "no_subsidy_guarantee", "site_survey_required", "score_not_official", "ai_may_err"]), text: z.string() }))
      .length(ADVISOR_DISCLAIMER_CODES.length),
    facts: z.array(factSchema),
    quote_labels: z.array(
      z.object({
        label: z.string(),
        quoteId: z.string(),
        vendorDisplayName: z.string(),
        isDemo: z.boolean(),
        status: z.enum(["submitted", "accepted"]),
        rank: z.number().nullable(),
      }),
    ),
  })
  .refine((d) => (d.ai_status === "used") === (d.source === "ai"), { message: "ai_status used iff source is ai" });

export type AdvisorExplanationResponse = z.infer<typeof advisorExplanationResponseSchema>;
