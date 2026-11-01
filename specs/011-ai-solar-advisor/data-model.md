# Data Model: AI Solar Advisor (011)

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md)

This feature adds **no tables, columns, buckets, policies or migrations** and writes nothing.
It reads (via the caller's RLS-bound client) tables owned by other features, exactly as named in
overview §7. All objects below are transient DTOs/Zod schemas.

## 1. Read model (overview §7 tables, read-only)

| Table (owner) | Rows read | Columns used | Never used |
|---|---|---|---|
| `household_requests` (002) | the one request, via 002 `getOwnRequest` | `id`, `status`, `monthly_units`, `monthly_bill`, `budget`, `preferred_capacity_kw`, `ai_consent`, `roof_photo_path` (stale check only) | `address_text`, `latitude`, `longitude`, `locality`, `user_id` |
| `roof_assessments` (008) | latest completed + latest attempt, via 008 `getRoofAssessmentState` | `status`, `observations`, `potential_obstructions`, `limitations`, `site_survey_required` (+ `is_current_photo` from 008's DTO) | `model`, `prompt_version`, `failure_reason` |
| `solar_estimates` (003) | 0–1 per request | `capacity_kw`, `installation_cost`, `subsidy_estimate`, `net_cost`, `annual_generation_kwh`, `annual_savings_estimate`, `payback_years`, `rule_version`, `assumptions.tariffPerKwh`, `assumptions.generationKwhPerKwYear` | `assumptions.notes` |
| `quotes` (005) | `status in ('submitted','accepted')` for the request | `id`, `vendor_id`, `status`, `price`, `capacity_kw`, `installation_days`, `earthing_included`, `documentation_included`, `created_at` | `panel_details`, `inverter_details`, `warranty_details` (raw), `other_inclusions`, `exclusions`, `vendor_notes`, `source`, `source_document_path` |
| `quote_reviews` (006) | for those quotes | `quote_id`, `total_score`, `scoring_version`, `missing_fields`, `flags[].code`, `flags[].severity`, `score_breakdown.parts.{price,technical,warranty,completeness,timeline}.{points,max}`, `score_breakdown.parts.price.notCompared`, `score_breakdown.parts.warranty.items[].{key,years}`, `score_breakdown.parts.completeness.{stated,total}`, `score_breakdown.comparison.{rank,comparedCount,tied,comparedQuoteIds}`, `normalized_fields.pricePerKw`, `normalized_fields.platformEstimates.{subsidyEstimate,netCostEstimate}` | `explanation`, `flags[].message`, `parts.*.reason`, `penalties[].message`, `normalized_fields.vendorText`, brand/model strings |
| `vendors` (001) | vendors of those quotes | `company_name`, `verification_status` — **display map only** | everything else |
| `quote_acceptances` (007) | not read; the accepted state is taken from `quotes.status = 'accepted'` / request status | — | — |

## 2. `AdvisorFacts` (`src/lib/domain/advisor/types.ts`)

```text
AdvisorFacts {
  mode: "no_data" | "no_quotes" | "needs_comparison" | "compare" | "accepted"
  leadingQuoteLabel: QuoteLabel | null       // decided by code (research R3)
  facts: AdvisorFact[]
  roofObservationTexts: Record<factId, string>   // untrusted text, sent only via untrustedText
  quoteLabels: QuoteLabelEntry[]             // display map; never sent to the AI
}

AdvisorFact {
  id: string            // stable, e.g. "estimate.net_cost", "quote.B.total_score"
  section: "observed" | "calculations" | "recommendation"
  label: string         // plain English, code constant
  value: number | string | boolean | null
  unit: "inr" | "inr_per_year" | "kw" | "kwh_per_month" | "kwh_per_year" | "inr_per_kwh"
        | "kwh_per_kw_year" | "years" | "days" | "points" | "count" | null
  kind: "household_input" | "estimate" | "vendor_stated" | "score" | "roof_observation" | "status"
}

QuoteLabel = "A" | "B" | … (single uppercase letter, assigned by created_at, then id)
QuoteLabelEntry { label, quoteId, vendorDisplayName, isDemo, status, rank: number | null }
```

`mode = "no_data"` when the request has no estimate, no roof assessment and no quotes.

### Fact catalogue (ids)

| Section | Fact ids (value source) |
|---|---|
| observed | `roof.status` (`completed` \| `failed` \| `none` \| `no_consent`), `roof.is_current_photo`, `roof.observation.{i}.object`, `roof.observation.{i}.confidence`, `roof.observation.{i}.text` (text in `roofObservationTexts` only), `roof.obstructions` (joined list), `roof.limitation.{i}`, `roof.site_survey_required`, `roof.observation_count` |
| calculations | `input.monthly_units`, `input.monthly_bill`, `input.budget`, `input.preferred_capacity_kw`, `estimate.capacity_kw`, `estimate.installation_cost`, `estimate.subsidy_estimate`, `estimate.net_cost`, `estimate.annual_generation_kwh`, `estimate.annual_savings_estimate`, `estimate.payback_years` (null allowed), `estimate.rule_version`, `estimate.tariff_per_kwh`, `estimate.generation_kwh_per_kw_year` |
| recommendation | `quotes.count`, `quotes.compared_count`, `quote.{L}.price`, `quote.{L}.capacity_kw`, `quote.{L}.price_per_kw`, `quote.{L}.installation_days`, `quote.{L}.earthing_included`, `quote.{L}.documentation_included`, `quote.{L}.subsidy_estimate`, `quote.{L}.net_cost_estimate`, `quote.{L}.total_score`, `quote.{L}.rank`, `quote.{L}.tied`, `quote.{L}.score.{part}` and `quote.{L}.score.{part}.max` (part ∈ price, technical, warranty, completeness, timeline), `quote.{L}.warranty.{key}.years`, `quote.{L}.completeness.stated`, `quote.{L}.completeness.total`, `quote.{L}.missing` (plain-label list), `quote.{L}.missing_count`, `quote.{L}.flags` (plain-label list), `quote.{L}.excluded`, `quote.{L}.status`, `scoring.version`, `scoring.max_total` (= 100) |

Values are copied, never computed, except: `roof.observation_count`, `quotes.count`,
`quote.{L}.missing_count` (counts of stored arrays) and label/plain-text mapping. Missing-item
keys (006 data-model §4) and flag codes map to plain labels via
`src/lib/domain/advisor/plain-labels.ts` (e.g. `earthingStated` → "earthing", `ABOVE_BUDGET` →
"price above your budget").

## 3. Request DTO — `advisorExplainRequestSchema` (`src/lib/validation/advisor.ts`)

| Field | Type | Rules |
|---|---|---|
| `request_id` | string | UUID; required |

`.strict()`; unknown keys → `400 VALIDATION_FAILED`.

## 4. AI output schema — `advisorExplanationAiOutputSchema` (`src/lib/ai/schemas/advisor-explain.ts`)

```text
{
  observed:       { summary: string(1..300), points: Point[0..5] },
  calculations:   { summary: string(1..300), points: Point[0..5] },
  recommendation: { summary: string(1..300), points: Point[0..5],
                    leading_quote_label: string(/^[A-Z]$/) | null },
  limitations:    string(1..200)[0..5]
}
Point = { text: string(1..280), fact_refs: string(1..80)[1..6] }
```

`.strict()` at every level (extra keys → `invalid_output`). Strings are trimmed; control
characters rejected. Passing the schema is necessary but not sufficient: the output must then
pass `validateAdvisorExplanation` (§6).

## 5. Response DTO — `advisorExplanationResponseSchema` (`src/lib/validation/advisor.ts`)

Inside the success envelope `{ "data": … }`:

| Field | Type | Notes |
|---|---|---|
| `request_id` | uuid | |
| `generated_at` | ISO timestamp | |
| `source` | `"ai"` \| `"template"` | FR-011 label |
| `ai_status` | `"used"` \| `"rejected"` \| `"invalid_output"` \| `"unavailable"` \| `"not_configured"` | `used` iff `source = "ai"` |
| `mode` | as §2 | |
| `sections.observed` | `Section` | title "What I observed" |
| `sections.calculations` | `Section` | title "What the calculations show" |
| `sections.recommendation` | `Section` + `leading_quote_label` | title "What I recommend" |
| `limitations` | string[] | from AI (validated) or template |
| `disclaimers` | `{ code, text }[]` | always the 5 codes in §7 |
| `facts` | `AdvisorFact[]` (without `roofObservationTexts` raw keys; observation text included as `value` for display) | evidence source for the UI |
| `quote_labels` | `QuoteLabelEntry[]` | display map (vendor names shown by the page only) |

`Section = { title: string, available: boolean, summary: string, points: { text, fact_refs }[] }`

The response never contains rejection details beyond `ai_status`; issue codes are logged.

## 6. Validation issues — `AdvisorValidationIssue` (`src/lib/domain/advisor/validate-explanation.ts`)

| Code | Meaning (research R5) |
|---|---|
| `unknown_fact_ref` | a point cites a fact id that does not exist |
| `wrong_leading_quote` | `leading_quote_label` ≠ code's leading label |
| `unknown_quote_label` | text mentions "Quote X" for a non-existent label |
| `summary_names_other_quote` | recommendation summary names a non-leading label, or omits the leading one |
| `number_not_in_cited_facts` | number in a point not allowed by its cited facts |
| `number_not_in_facts` | number in a summary/limitation not allowed by any fact |
| `spelled_out_number` | amount/quantity written in words |
| `prohibited_claim` | guarantee/eligibility/verification/official-rating/"best" claim |

## 7. Disclaimers (`src/lib/domain/advisor/disclaimers.ts`, fixed)

| Code | Text (final wording may be polished; meaning fixed) |
|---|---|
| `estimates_only` | "All amounts are indicative estimates based on rule version {rule_version}, not quotes or final prices." |
| `no_subsidy_guarantee` | "Subsidy is not guaranteed. Eligibility and payment are decided through the official PM Surya Ghar process." |
| `site_survey_required` | "A site survey by the installer is required before final design and price." |
| `score_not_official` | "Comparison score defined by SURYAMIT for guidance only — not a government, official or certification rating." (006 wording) |
| `ai_may_err` | "Explanations may be written by AI and can be imperfect. All numbers come from SURYAMIT's calculations and the vendors' quotes." |

## 8. Client state (`src/components/advisor/advisor-panel.tsx`)

`loading → success(data) | error(retry)`; "Refresh explanation" re-posts and keeps the previous
data visible until the new one arrives. No browser storage.
