// Deterministic quote scoring (specs/006 R-04). Reads ONLY ScoringInput; unknown values earn 0 and are
// listed as penalties. Each part is rounded to integer tenths; the total is the sum of rounded parts.
import { scoringConfig, type ScoringConfig, type TechnicalItem } from "@/config/scoring.v1";
import { detectMissingFields } from "./missing-fields";
import type {
  Penalty,
  QuoteReview,
  ScoreBreakdown,
  ScoringInput,
  TechnicalItemResult,
  WarrantyItemResult,
} from "./types";

const tenthsOf = (raw: number) => Math.round(raw * 10 + 1e-9);
const fromTenths = (t: number) => t / 10;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function scorePrice(ppk: number, minPpk: number, comparedCount: number, config: ScoringConfig = scoringConfig) {
  const max = config.weights.price;
  const notCompared = comparedCount < 2;
  const tenths = notCompared ? max * 10 : tenthsOf((max * minPpk) / ppk);
  const reason = notCompared
    ? "Only one quote received, so there is no other price to compare."
    : ppk <= minPpk
      ? `Lowest price per kW (₹${Math.round(ppk).toLocaleString("en-IN")}).`
      : `Price per kW ₹${Math.round(ppk).toLocaleString("en-IN")} is ${Math.round((ppk / minPpk - 1) * 100)}% above the lowest (₹${Math.round(minPpk).toLocaleString("en-IN")}).`;
  return { tenths, max, reason, notCompared };
}

const TECH_COPY: Record<TechnicalItem, { label: string; unknown: string }> = {
  panelDetailsComplete: { label: "Panel brand, wattage and quantity", unknown: "Panel details not fully stated" },
  panelCapacityConsistent: { label: "Panel total matches quoted capacity", unknown: "Panel wattage or quantity not stated" },
  inverterDetailsComplete: { label: "Inverter brand, type and capacity", unknown: "Inverter details not fully stated" },
  inverterAdequatelySized: { label: "Inverter at least 80% of capacity", unknown: "Inverter capacity not stated" },
  earthingIncluded: { label: "Earthing included", unknown: "Earthing not stated" },
};

export function scoreTechnical(q: ScoringInput, config: ScoringConfig = scoringConfig) {
  const pts = config.technical.pointsPerItem;
  const known = {
    panelDetailsComplete: q.panel.brand !== null && q.panel.wattage !== null && q.panel.quantity !== null,
    panelCapacityConsistent: q.panel.wattage !== null && q.panel.quantity !== null,
    inverterDetailsComplete: q.inverter.brand !== null && q.inverter.type !== null && q.inverter.capacityKw !== null,
    inverterAdequatelySized: q.inverter.capacityKw !== null,
    earthingIncluded: q.earthingIncluded !== null,
  } satisfies Record<TechnicalItem, boolean>;

  const met: Record<TechnicalItem, boolean> = {
    panelDetailsComplete: known.panelDetailsComplete,
    panelCapacityConsistent:
      known.panelCapacityConsistent &&
      r6(Math.abs((q.panel.wattage! * q.panel.quantity!) / 1000 - q.capacityKw) / q.capacityKw) <= config.tolerances.capacityMismatchRatio,
    inverterDetailsComplete: known.inverterDetailsComplete,
    inverterAdequatelySized: known.inverterAdequatelySized && r6(q.inverter.capacityKw! / q.capacityKw) >= config.tolerances.inverterMinRatio,
    earthingIncluded: q.earthingIncluded === true,
  };

  const items: TechnicalItemResult[] = [];
  const penalties: Penalty[] = [];
  for (const key of config.technical.items) {
    const copy = TECH_COPY[key];
    if (!known[key]) {
      items.push({ key, points: 0, max: pts, status: "unknown", reason: `${copy.unknown}.` });
      penalties.push({ part: "technical", item: key, pointsForgone: pts, message: `${copy.unknown} (−${pts})` });
    } else if (met[key]) {
      items.push({ key, points: pts, max: pts, status: "met", reason: `${copy.label}: yes.` });
    } else {
      items.push({ key, points: 0, max: pts, status: "not_met", reason: key === "earthingIncluded" ? "Earthing is not included." : `${copy.label}: no.` });
    }
  }
  const tenths = items.reduce((s, i) => s + i.points * 10, 0);
  return { tenths, max: config.weights.technical, items, penalties };
}

const WARRANTY_LABEL = {
  panelProduct: "Panel product warranty",
  panelPerformance: "Panel performance warranty",
  inverter: "Inverter warranty",
  workmanship: "Workmanship warranty",
} as const;

export function scoreWarranty(q: ScoringInput, config: ScoringConfig = scoringConfig) {
  const items: WarrantyItemResult[] = [];
  const penalties: Penalty[] = [];
  let raw = 0;
  for (const key of ["panelProduct", "panelPerformance", "inverter", "workmanship"] as const) {
    const { points, targetYears } = config.warranty[key];
    const years = q.warranty[key];
    const earned = years === null ? 0 : points * Math.min(years / targetYears, 1);
    raw += earned;
    items.push({ key, years, points: fromTenths(tenthsOf(earned)), max: points, target: targetYears });
    if (years === null) {
      penalties.push({ part: "warranty", item: key, pointsForgone: points, message: `${WARRANTY_LABEL[key]} not stated (−${points})` });
    }
  }
  return { tenths: tenthsOf(raw), max: config.weights.warranty, items, penalties };
}

export function scoreCompleteness(q: ScoringInput, config: ScoringConfig = scoringConfig) {
  const total = config.recommendedItems.length;
  const missing = detectMissingFields(q).length;
  const stated = total - missing;
  const tenths = tenthsOf((config.weights.completeness * stated) / total);
  const penalties: Penalty[] = [];
  if (missing > 0) {
    const forgone = fromTenths(config.weights.completeness * 10 - tenths);
    penalties.push({
      part: "completeness",
      item: "recommendedItems",
      pointsForgone: forgone,
      message: `${missing} recommended ${missing === 1 ? "detail" : "details"} not stated (−${fmt(forgone)})`,
    });
  }
  return { tenths, max: config.weights.completeness, stated, total, penalties };
}

export function scoreTimeline(q: ScoringInput, config: ScoringConfig = scoringConfig) {
  const max = config.weights.timeline;
  const { fullPointsAtOrBelowDays: lo, zeroPointsAtOrAboveDays: hi } = config.timeline;
  const d = q.installationDays;
  const penalties: Penalty[] = [];
  let tenths = 0;
  if (d === null) {
    penalties.push({ part: "timeline", item: "installationDays", pointsForgone: max, message: `Installation timeline not stated (−${max})` });
  } else if (d <= lo) tenths = max * 10;
  else if (d >= hi) tenths = 0;
  else tenths = tenthsOf((max * (hi - d)) / (hi - lo));
  return { tenths, max, days: d, penalties };
}

type Scored = { input: ScoringInput; ppk: number; totalTenths: number; breakdown: Omit<ScoreBreakdown, "comparison"> };

function scoreOne(input: ScoringInput, minPpk: number, comparedCount: number, config: ScoringConfig): Scored {
  const ppk = input.price / input.capacityKw;
  const price = scorePrice(ppk, minPpk, comparedCount, config);
  const tech = scoreTechnical(input, config);
  const warranty = scoreWarranty(input, config);
  const completeness = scoreCompleteness(input, config);
  const timeline = scoreTimeline(input, config);
  const totalTenths = price.tenths + tech.tenths + warranty.tenths + completeness.tenths + timeline.tenths;
  const breakdown = {
    version: config.version,
    parts: {
      price: { points: fromTenths(price.tenths), max: price.max, reason: price.reason, ...(price.notCompared ? { notCompared: true as const } : {}) },
      technical: { points: fromTenths(tech.tenths), max: tech.max, items: tech.items },
      warranty: { points: fromTenths(warranty.tenths), max: warranty.max, items: warranty.items },
      completeness: { points: fromTenths(completeness.tenths), max: completeness.max, stated: completeness.stated, total: completeness.total },
      timeline: { points: fromTenths(timeline.tenths), max: timeline.max, days: timeline.days },
    },
    penalties: [...tech.penalties, ...warranty.penalties, ...completeness.penalties, ...timeline.penalties],
    total: fromTenths(totalTenths),
  };
  return { input, ppk, totalTenths, breakdown };
}

/**
 * Scores and ranks quotes. Comparator: total desc, price per kW asc, submittedAt asc, quoteId asc.
 * The output is independent of input order.
 */
export function scoreQuotes(inputs: ScoringInput[], config: ScoringConfig = scoringConfig): QuoteReview[] {
  if (inputs.length === 0) return [];
  const minPpk = Math.min(...inputs.map((i) => i.price / i.capacityKw));
  const scored = inputs.map((i) => scoreOne(i, minPpk, inputs.length, config));
  scored.sort(
    (a, b) =>
      b.totalTenths - a.totalTenths ||
      a.ppk - b.ppk ||
      (a.input.submittedAt < b.input.submittedAt ? -1 : a.input.submittedAt > b.input.submittedAt ? 1 : 0) ||
      (a.input.quoteId < b.input.quoteId ? -1 : a.input.quoteId > b.input.quoteId ? 1 : 0),
  );
  const ids = scored.map((s) => s.input.quoteId);
  const counts = new Map<number, number>();
  for (const s of scored) counts.set(s.totalTenths, (counts.get(s.totalTenths) ?? 0) + 1);

  return scored.map((s, idx) => {
    const tied = (counts.get(s.totalTenths) ?? 0) > 1;
    return {
      quoteId: s.input.quoteId,
      rank: idx + 1,
      tied,
      totalScore: s.breakdown.total,
      pricePerKw: s.ppk,
      scoreBreakdown: { ...s.breakdown, comparison: { rank: idx + 1, comparedCount: inputs.length, tied, comparedQuoteIds: ids } },
    };
  });
}
