// Deterministic fidelity check for AI-written explanations (specs/011 R5, FR-009).
// Any single issue rejects the whole output; the caller then uses the template. Pure.
import { extractNumbers, isTokenAllowed } from "./number-fidelity";
import type { AdvisorExplanation, AdvisorFacts, AdvisorValidationIssue, ValidationResult } from "./types";

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|half";
const UNIT_WORDS = "lakh|lac|crore|thousand|hundred|rupees?|rs|kw|kilowatts?|years?|days?|points?|percent";
const SPELLED_RE = new RegExp(`\\b(?:(?:${NUMBER_WORDS})\\s+(?:${UNIT_WORDS})|a\\s+(?:lakh|lac|crore|thousand|hundred))\\b`, "i");

const NEGATION_RE = /\b(?:not|no|never|isn't|cannot|can't|without|nor)\b/i;
const CLAIM_PATTERNS: RegExp[] = [
  /\bguarantee(?:d|s)?\b/gi,
  /\bassured\b/gi,
  /\byou are eligible\b/gi,
  /\byou will (?:get|receive)\b/gi,
  /\b(?:verified|certified|approved)\s+(?:vendor|installer|company)s?\b/gi,
  /\bgovernment[- ]approved\b/gi,
  /\bofficial\s+(?:rating|score|ranking)s?\b/gi,
  /\bbest\s+(?:quote|vendor|installer|option|choice)s?\b/gi,
];

function hasProhibitedClaim(text: string): boolean {
  for (const re of CLAIM_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(0, m.index).split(/\s+/).filter(Boolean).slice(-3).join(" ");
      if (!NEGATION_RE.test(before)) return true;
    }
  }
  return false;
}

type TextItem = { text: string; refs: string[] | null };

function collectText(o: AdvisorExplanation): { items: TextItem[]; all: string[] } {
  const items: TextItem[] = [];
  for (const s of [o.observed, o.calculations, o.recommendation]) {
    items.push({ text: s.summary, refs: null });
    for (const p of s.points) items.push({ text: p.text, refs: p.fact_refs });
  }
  for (const l of o.limitations) items.push({ text: l, refs: null });
  return { items, all: items.map((i) => i.text) };
}

export function validateAdvisorExplanation(output: AdvisorExplanation, facts: AdvisorFacts): ValidationResult {
  const issues = new Set<AdvisorValidationIssue>();
  const byId = new Map(facts.facts.map((f) => [f.id, f]));
  const labels = new Set(facts.quoteLabels.map((q) => q.label));
  const numericValues = facts.facts.map((f) => f.value).filter((v): v is number => typeof v === "number");

  // 1. Fact references
  for (const s of [output.observed, output.calculations, output.recommendation]) {
    for (const p of s.points) if (p.fact_refs.some((r) => !byId.has(r))) issues.add("unknown_fact_ref");
  }

  // 2. Leading quote
  if ((output.recommendation.leading_quote_label ?? null) !== facts.leadingQuoteLabel) issues.add("wrong_leading_quote");

  const { items, all } = collectText(output);

  // 3. Labels
  for (const text of all) {
    for (const m of text.matchAll(/\bQuote\s+([A-Z])\b/g)) if (!labels.has(m[1])) issues.add("unknown_quote_label");
  }
  const summaryLabels = new Set([...output.recommendation.summary.matchAll(/\bQuote\s+([A-Z])\b/g)].map((m) => m[1]));
  const expected = facts.leadingQuoteLabel;
  if (expected ? !summaryLabels.has(expected) || [...summaryLabels].some((l) => l !== expected && labels.has(l)) : [...summaryLabels].some((l) => labels.has(l))) {
    issues.add("summary_names_other_quote");
  }

  // 4. Numbers
  for (const item of items) {
    const tokens = extractNumbers(item.text);
    if (tokens.length === 0) continue;
    if (item.refs) {
      const cited = item.refs.map((r) => byId.get(r)?.value).filter((v): v is number => typeof v === "number");
      if (tokens.some((t) => !isTokenAllowed(t, cited))) issues.add("number_not_in_cited_facts");
    } else if (tokens.some((t) => !isTokenAllowed(t, numericValues))) {
      issues.add("number_not_in_facts");
    }
  }

  // 5. Spelled-out amounts, 6. prohibited claims
  if (all.some((t) => SPELLED_RE.test(t))) issues.add("spelled_out_number");
  if (all.some(hasProhibitedClaim)) issues.add("prohibited_claim");

  return issues.size === 0 ? { ok: true } : { ok: false, issues: [...issues] };
}
