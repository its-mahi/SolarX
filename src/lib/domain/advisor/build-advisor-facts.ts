// Assembles advisor facts from stored, code-computed results (specs/011 R2, R3).
// Pure. Copies values, counts arrays, maps keys to plain labels. It contains no ranking logic:
// the rank is read from the stored comparison. No household personal data, vendor names or
// vendor free text ever enter `facts`; names live only in `quoteLabels` (display map).
import { plainFlagLabel, plainList, plainMissingLabel } from "./plain-labels";
import type {
  AdvisorFact,
  AdvisorFactKind,
  AdvisorFactUnit,
  AdvisorFacts,
  AdvisorInputs,
  AdvisorMode,
  AdvisorQuoteInput,
  AdvisorSectionKey,
  QuoteLabel,
  QuoteLabelEntry,
} from "./types";

export const SCORING_MAX_TOTAL = 100;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function labelQuotes(quotes: AdvisorQuoteInput[]): { label: QuoteLabel; quote: AdvisorQuoteInput }[] {
  return [...quotes]
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, LETTERS.length)
    .map((quote, i) => ({ label: LETTERS[i], quote }));
}

function rankOf(q: AdvisorQuoteInput): number | null {
  return q.review?.comparison?.rank ?? null;
}

/** Decides mode and leading quote from stored data only (research R3). */
function decideMode(labelled: { label: QuoteLabel; quote: AdvisorQuoteInput }[]): { mode: AdvisorMode; leading: QuoteLabel | null } {
  const accepted = labelled.find((l) => l.quote.status === "accepted");
  if (accepted) return { mode: "accepted", leading: accepted.label };
  const submitted = labelled.filter((l) => l.quote.status === "submitted");
  if (submitted.length === 0) return { mode: "no_quotes", leading: null };

  const needs = { mode: "needs_comparison" as AdvisorMode, leading: null };
  if (submitted.some((l) => !l.quote.review)) return needs;

  const ranked = submitted.filter((l) => rankOf(l.quote) !== null);
  const excludedIds = new Set(submitted.filter((l) => rankOf(l.quote) === null).map((l) => l.quote.id));
  const rankedIds = new Set(ranked.map((l) => l.quote.id));
  if (ranked.length === 0) return needs;

  for (const l of ranked) {
    const compared = l.quote.review!.comparison!.comparedQuoteIds;
    const set = new Set(compared.filter((id) => !excludedIds.has(id)));
    if (set.size !== rankedIds.size || [...rankedIds].some((id) => !set.has(id))) return needs;
  }
  const first = ranked.find((l) => rankOf(l.quote) === 1);
  if (!first) return needs;
  return { mode: "compare", leading: first.label };
}

export function buildAdvisorFacts(input: AdvisorInputs): AdvisorFacts {
  const facts: AdvisorFact[] = [];
  const roofTexts: Record<string, string> = {};
  const add = (
    id: string,
    section: AdvisorSectionKey,
    label: string,
    value: AdvisorFact["value"],
    unit: AdvisorFactUnit,
    kind: AdvisorFactKind,
  ) => {
    facts.push({ id, section, label, value, unit, kind });
  };

  // ---- observed ----
  const roof = input.roof;
  add("roof.status", "observed", "Roof analysis", roof.state, null, "status");
  if (roof.state === "completed") {
    add("roof.is_current_photo", "observed", "Observations relate to the current photo", roof.isCurrentPhoto, null, "status");
    add("roof.observation_count", "observed", "Items noticed in the photo", roof.observations.length, "count", "roof_observation");
    roof.observations.forEach((o, i) => {
      add(`roof.observation.${i}.object`, "observed", "Item noticed", o.object, null, "roof_observation");
      add(`roof.observation.${i}.confidence`, "observed", "AI confidence", o.confidence, null, "roof_observation");
      add(`roof.observation.${i}.text`, "observed", "What it might mean", o.potentialImpact, null, "roof_observation");
      roofTexts[`roof.observation.${i}.object`] = o.object;
      roofTexts[`roof.observation.${i}.text`] = `${o.description} ${o.potentialImpact}`.trim();
    });
    if (roof.obstructions.length > 0) {
      const joined = roof.obstructions.join("; ");
      add("roof.obstructions", "observed", "Possible obstructions", joined, null, "roof_observation");
      roofTexts["roof.obstructions"] = joined;
    }
    roof.limitations.forEach((l, i) => {
      add(`roof.limitation.${i}`, "observed", "Limitation", l, null, "roof_observation");
      roofTexts[`roof.limitation.${i}`] = l;
    });
    add("roof.site_survey_required", "observed", "Site survey required", roof.siteSurveyRequired, null, "status");
  }

  // ---- calculations ----
  const r = input.request;
  if (r.monthlyUnits !== null) add("input.monthly_units", "calculations", "Monthly electricity use", r.monthlyUnits, "kwh_per_month", "household_input");
  if (r.monthlyBill !== null) add("input.monthly_bill", "calculations", "Monthly electricity bill", r.monthlyBill, "inr", "household_input");
  if (r.budget !== null) add("input.budget", "calculations", "Your budget", r.budget, "inr", "household_input");
  if (r.preferredCapacityKw !== null) add("input.preferred_capacity_kw", "calculations", "Your preferred size", r.preferredCapacityKw, "kw", "household_input");
  const e = input.estimate;
  if (e) {
    add("estimate.capacity_kw", "calculations", "Indicative system size", e.capacityKw, "kw", "estimate");
    add("estimate.installation_cost", "calculations", "Estimated installation cost", e.installationCost, "inr", "estimate");
    add("estimate.subsidy_estimate", "calculations", "Estimated central subsidy (CFA)", e.subsidyEstimate, "inr", "estimate");
    add("estimate.net_cost", "calculations", "Estimated net cost", e.netCost, "inr", "estimate");
    add("estimate.annual_generation_kwh", "calculations", "Estimated yearly generation", e.annualGenerationKwh, "kwh_per_year", "estimate");
    add("estimate.annual_savings_estimate", "calculations", "Estimated yearly savings", e.annualSavingsEstimate, "inr_per_year", "estimate");
    add("estimate.payback_years", "calculations", "Estimated payback", e.paybackYears, "years", "estimate");
    add("estimate.rule_version", "calculations", "Rule version", e.ruleVersion, null, "estimate");
    if (e.tariffPerKwh !== null) add("estimate.tariff_per_kwh", "calculations", "Tariff used", e.tariffPerKwh, "inr_per_kwh", "estimate");
    if (e.generationKwhPerKwYear !== null) {
      add("estimate.generation_kwh_per_kw_year", "calculations", "Generation per kW per year", e.generationKwhPerKwYear, "kwh_per_kw_year", "estimate");
    }
  }

  // ---- recommendation ----
  const labelled = labelQuotes(input.quotes);
  const { mode: quoteMode, leading } = decideMode(labelled);
  add("quotes.count", "recommendation", "Quotes received", labelled.length, "count", "status");
  const rankedCount = labelled.filter((l) => l.quote.status === "submitted" && rankOf(l.quote) !== null).length;
  if (quoteMode === "compare") add("quotes.compared_count", "recommendation", "Quotes scored", rankedCount, "count", "score");

  const quoteLabels: QuoteLabelEntry[] = [];
  let scoringVersion: string | null = null;
  for (const { label, quote: q } of labelled) {
    const rev = q.review;
    const rank = rankOf(q);
    quoteLabels.push({
      label,
      quoteId: q.id,
      vendorDisplayName: q.vendorDisplayName,
      isDemo: q.isDemo,
      status: q.status,
      rank,
    });
    const p = `quote.${label}`;
    add(`${p}.status`, "recommendation", `Quote ${label} status`, q.status, null, "status");
    add(`${p}.price`, "recommendation", `Quote ${label} price`, q.price, "inr", "vendor_stated");
    add(`${p}.capacity_kw`, "recommendation", `Quote ${label} capacity`, q.capacityKw, "kw", "vendor_stated");
    if (q.installationDays !== null) add(`${p}.installation_days`, "recommendation", `Quote ${label} installation time`, q.installationDays, "days", "vendor_stated");
    add(`${p}.earthing_included`, "recommendation", `Quote ${label} earthing included`, q.earthingIncluded, null, "vendor_stated");
    add(`${p}.documentation_included`, "recommendation", `Quote ${label} documentation included`, q.documentationIncluded, null, "vendor_stated");
    if (!rev) continue;
    scoringVersion ??= rev.scoringVersion;
    if (rev.pricePerKw !== null) add(`${p}.price_per_kw`, "recommendation", `Quote ${label} price per kW`, rev.pricePerKw, "inr", "vendor_stated");
    if (rev.subsidyEstimate !== null) add(`${p}.subsidy_estimate`, "recommendation", `Quote ${label} estimated subsidy`, rev.subsidyEstimate, "inr", "estimate");
    if (rev.netCostEstimate !== null) add(`${p}.net_cost_estimate`, "recommendation", `Quote ${label} estimated net cost`, rev.netCostEstimate, "inr", "estimate");
    const excluded = rank === null;
    add(`${p}.excluded`, "recommendation", `Quote ${label} excluded from scoring`, excluded, null, "status");
    const missing = rev.missingFields.map(plainMissingLabel);
    add(`${p}.missing`, "recommendation", `Quote ${label} missing details`, plainList(missing), null, "score");
    add(`${p}.missing_count`, "recommendation", `Quote ${label} missing detail count`, new Set(missing).size, "count", "score");
    if (rev.flags.length > 0) add(`${p}.flags`, "recommendation", `Quote ${label} notes`, plainList(rev.flags.map((f) => plainFlagLabel(f.code))), null, "score");
    if (excluded) continue;
    add(`${p}.total_score`, "recommendation", `Quote ${label} comparison score`, rev.totalScore, "points", "score");
    add(`${p}.rank`, "recommendation", `Quote ${label} rank`, rank, null, "score");
    add(`${p}.tied`, "recommendation", `Quote ${label} tied on score`, rev.comparison?.tied ?? false, null, "score");
    for (const part of ["price", "technical", "warranty", "completeness", "timeline"] as const) {
      add(`${p}.score.${part}`, "recommendation", `Quote ${label} ${part} points`, rev.parts[part].points, "points", "score");
      add(`${p}.score.${part}.max`, "recommendation", `Quote ${label} ${part} maximum`, rev.parts[part].max, "points", "score");
    }
    if (rev.parts.price.notCompared) add(`${p}.price_not_compared`, "recommendation", `Quote ${label} price not compared`, true, null, "score");
    for (const item of rev.parts.warranty.items) {
      if (item.years !== null) add(`${p}.warranty.${item.key}.years`, "recommendation", `Quote ${label} warranty ${item.key}`, item.years, "years", "vendor_stated");
    }
    if (rev.parts.completeness.stated !== null) add(`${p}.completeness.stated`, "recommendation", `Quote ${label} details stated`, rev.parts.completeness.stated, "count", "score");
    if (rev.parts.completeness.total !== null) add(`${p}.completeness.total`, "recommendation", `Quote ${label} details recommended`, rev.parts.completeness.total, "count", "score");
  }
  if (scoringVersion) {
    add("scoring.version", "recommendation", "Scoring version", scoringVersion, null, "score");
    add("scoring.max_total", "recommendation", "Maximum score", SCORING_MAX_TOTAL, "points", "score");
  }

  const mode: AdvisorMode =
    !input.estimate && roof.state !== "completed" && labelled.length === 0 ? "no_data" : quoteMode;

  return { mode, leadingQuoteLabel: mode === "no_data" ? null : leading, facts, roofObservationTexts: roofTexts, quoteLabels };
}

/** Facts that go to the AI as trusted data: everything except photo-derived free text. */
export function factsForPrompt(facts: AdvisorFacts): AdvisorFact[] {
  return facts.facts.filter((f) => !(f.id in facts.roofObservationTexts) && !f.id.endsWith(".text"));
}
