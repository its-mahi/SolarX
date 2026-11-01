// Deterministic "standard summary" (specs/011 R6). Fixed sentences filled only from stored facts;
// works with no AI and is the fallback for every AI failure. Pure.
import { formatInr, formatKw, formatUnits } from "@/lib/format";
import type { AdvisorFact, AdvisorFacts, ExplanationPoint, TemplateExplanation } from "./types";

const REASONS = {
  no_consent: "you have not allowed AI analysis of your roof photo",
  failed: "the analysis could not be completed",
  none: "no roof analysis has been run yet",
} as const;

export function buildTemplateExplanation(f: AdvisorFacts): TemplateExplanation {
  const byId = new Map<string, AdvisorFact>(f.facts.map((x) => [x.id, x]));
  const num = (id: string): number | null => {
    const v = byId.get(id)?.value;
    return typeof v === "number" ? v : null;
  };
  const str = (id: string): string | null => {
    const v = byId.get(id)?.value;
    return typeof v === "string" ? v : null;
  };
  const has = (id: string) => byId.has(id);
  const refs = (...ids: string[]) => ids.filter(has);
  const inr = (id: string) => formatInr(num(id) ?? 0);

  // ---------- What I observed ----------
  const roofStatus = str("roof.status") ?? "none";
  const observed: TemplateExplanation["observed"] = { summary: "", points: [] };
  const roofAvailable = roofStatus === "completed";
  if (roofAvailable) {
    const count = num("roof.observation_count") ?? 0;
    const objects: string[] = [];
    const points: ExplanationPoint[] = [];
    for (let i = 0; i < count; i++) {
      const object = str(`roof.observation.${i}.object`) ?? "item";
      const conf = str(`roof.observation.${i}.confidence`) ?? "low";
      const impact = str(`roof.observation.${i}.text`) ?? "";
      objects.push(object);
      points.push({
        text: `${object} (${conf} confidence, from one photo): ${impact}`.trim(),
        fact_refs: refs(`roof.observation.${i}.object`, `roof.observation.${i}.confidence`, `roof.observation.${i}.text`),
      });
    }
    const stale = byId.get("roof.is_current_photo")?.value === false ? " These observations relate to a previous photo." : "";
    observed.summary =
      (objects.length > 0 ? `The photo shows: ${objects.join(", ")}.` : "The photo analysis did not find clear items on the roof.") + stale;
    const obstructions = str("roof.obstructions");
    if (obstructions) points.push({ text: `Possible obstructions: ${obstructions}.`, fact_refs: ["roof.obstructions"] });
    points.push({
      text: "A single photo has limits, so a site survey by the installer is required.",
      fact_refs: refs("roof.site_survey_required", "roof.status"),
    });
    observed.points = points;
  } else {
    const reason = REASONS[roofStatus as keyof typeof REASONS] ?? REASONS.none;
    observed.summary = `No roof analysis is available because ${reason}. A site survey by the installer is required.`;
  }

  // ---------- What the calculations show ----------
  const calculations: TemplateExplanation["calculations"] = { summary: "", points: [] };
  const hasEstimate = has("estimate.net_cost");
  if (hasEstimate) {
    calculations.summary = `An indicative ${formatKw(num("estimate.capacity_kw"))} system is estimated to cost ${inr("estimate.installation_cost")} before subsidy.`;
    calculations.points.push(
      {
        text: `Central subsidy (CFA) is government support under the scheme; your estimated subsidy is ${inr("estimate.subsidy_estimate")}.`,
        fact_refs: ["estimate.subsidy_estimate"],
      },
      {
        text: `Net cost is the installation cost after the estimated subsidy: ${inr("estimate.net_cost")}.`,
        fact_refs: ["estimate.installation_cost", "estimate.net_cost"],
      },
    );
    const payback = num("estimate.payback_years");
    const savings = num("estimate.annual_savings_estimate") ?? 0;
    calculations.points.push({
      text:
        payback === null
          ? `Payback is how long savings take to repay the net cost. Estimated yearly savings are ${formatInr(savings)}, so payback is not available.`
          : `Payback is how long savings take to repay the net cost. Estimated yearly savings are ${formatInr(savings)}; simple payback is about ${payback} years.`,
      fact_refs: refs("estimate.annual_savings_estimate", "estimate.payback_years"),
    });
    calculations.points.push({
      text: `Estimated yearly generation is ${formatUnits(num("estimate.annual_generation_kwh") ?? 0)}.`,
      fact_refs: ["estimate.annual_generation_kwh"],
    });
    calculations.points.push({
      text: `These figures use rule version ${str("estimate.rule_version")}.`,
      fact_refs: ["estimate.rule_version"],
    });
  } else {
    calculations.summary = "No estimate is available yet. Add your monthly electricity use and budget to your request to see one.";
  }

  // ---------- What I recommend ----------
  const recommendation: TemplateExplanation["recommendation"] = { summary: "", points: [], leading_quote_label: null };
  const leading = f.leadingQuoteLabel;
  const scoreMax = num("scoring.max_total");
  const quoteCount = num("quotes.count") ?? 0;
  let recAvailable = true;

  const quotePoint = (label: string): ExplanationPoint => {
    const p = `quote.${label}`;
    const parts: string[] = [];
    const used: string[] = [];
    const score = num(`${p}.total_score`);
    if (score !== null && scoreMax !== null) {
      parts.push(`score ${score} of ${scoreMax}`);
      used.push(`${p}.total_score`, "scoring.max_total");
    }
    parts.push(`price ${inr(`${p}.price`)}`, `capacity ${formatKw(num(`${p}.capacity_kw`))}`);
    used.push(`${p}.price`, `${p}.capacity_kw`);
    const days = num(`${p}.installation_days`);
    if (days !== null) {
      parts.push(`installation ${days} days`);
      used.push(`${p}.installation_days`);
    }
    const missing = str(`${p}.missing`);
    const missingList = missing ? missing.split(", ") : [];
    parts.push(
      missingList.length === 0
        ? "all recommended details stated"
        : `not stated: ${missingList.slice(0, 4).join(", ")}${missingList.length > 4 ? " and others" : ""}`,
    );
    used.push(...refs(`${p}.missing`));
    return { text: `Quote ${label}: ${parts.join(", ")}.`, fact_refs: refs(...used) };
  };

  if (f.mode === "no_quotes" || f.mode === "no_data") {
    recAvailable = false;
    recommendation.summary =
      f.mode === "no_data"
        ? "There is nothing to recommend yet. Finish your request so vendors can send quotes."
        : "No quotes have arrived yet. Vendors can quote once your request is open; check back later.";
  } else if (f.mode === "needs_comparison") {
    recAvailable = false;
    recommendation.summary = "Some quotes have not been scored yet. Open the comparison to score all quotes before choosing.";
    recommendation.points.push({ text: `${quoteCount} quotes have arrived.`, fact_refs: ["quotes.count"] });
  } else if (f.mode === "accepted" && leading) {
    recommendation.leading_quote_label = leading;
    recommendation.summary = `You accepted Quote ${leading}. It is your choice; the next steps are below.`;
    recommendation.points.push(quotePoint(leading), {
      text: "Confirm the final design and price with the installer after the site survey.",
      fact_refs: ["quotes.count"],
    });
  } else if (f.mode === "compare" && leading) {
    recommendation.leading_quote_label = leading;
    const ranked = f.quoteLabels
      .filter((q) => q.status === "submitted" && q.rank !== null)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const tied = byId.get(`quote.${leading}.tied`)?.value === true;
    recommendation.summary =
      ranked.length === 1
        ? `Quote ${leading} is the only scored quote, so its price was not compared with other quotes.`
        : `Quote ${leading} has the highest comparison score (${num(`quote.${leading}.total_score`)} of ${scoreMax}).${tied ? " Scores are tied; the stored tie-break order decides the lead." : ""}`;
    const p = `quote.${leading}`;
    const partIds = (["price", "technical", "warranty", "completeness", "timeline"] as const).filter((x) => has(`${p}.score.${x}`));
    if (partIds.length > 0) {
      recommendation.points.push({
        text: `Why: the score parts are ${partIds.map((x) => `${x} ${num(`${p}.score.${x}`)}`).join(", ")} points.`,
        fact_refs: partIds.map((x) => `${p}.score.${x}`),
      });
    }
    for (const q of ranked) recommendation.points.push(quotePoint(q.label));
    for (const q of f.quoteLabels.filter((x) => x.status === "submitted" && x.rank === null && has(`quote.${x.label}.excluded`))) {
      recommendation.points.push({
        text: `Quote ${q.label} could not be scored and is left out of the ranking.`,
        fact_refs: [`quote.${q.label}.excluded`],
      });
    }
    recommendation.points.push({
      text: "Next steps: confirm any missing details with the vendors, then book a site survey before you accept a quote.",
      fact_refs: ["quotes.count"],
    });
  }

  const limitations = [
    ...(roofAvailable ? ["Roof observations come from a single photo."] : []),
    "All amounts are estimates, not final prices.",
    "A site survey by the installer is required before final design and price.",
  ];

  return {
    observed,
    calculations,
    recommendation,
    limitations,
    available: { observed: roofAvailable, calculations: hasEstimate, recommendation: recAvailable },
  };
}
