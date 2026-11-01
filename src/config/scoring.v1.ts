// Quote comparison scoring configuration (specs/006 research R-01). Versioned: any change bumps scoring.v2.
// Scores are defined by SolarX for guidance only; they are not an official rating.
export const RECOMMENDED_ITEMS = [
  "panelBrand",
  "panelWattage",
  "panelQuantity",
  "panelCertifications",
  "inverterBrand",
  "inverterType",
  "inverterCapacity",
  "warrantyPanelProduct",
  "warrantyPanelPerformance",
  "warrantyInverter",
  "warrantyWorkmanship",
  "installationDays",
  "earthingStated",
  "documentationStated",
] as const;

export type RecommendedItem = (typeof RECOMMENDED_ITEMS)[number];

export const TECHNICAL_ITEMS = [
  "panelDetailsComplete",
  "panelCapacityConsistent",
  "inverterDetailsComplete",
  "inverterAdequatelySized",
  "earthingIncluded",
] as const;

export type TechnicalItem = (typeof TECHNICAL_ITEMS)[number];

export const scoringConfig = {
  version: "scoring.v1",
  weights: { price: 30, technical: 25, warranty: 20, completeness: 15, timeline: 10 },
  technical: { pointsPerItem: 5, items: TECHNICAL_ITEMS },
  warranty: {
    panelProduct: { points: 6, targetYears: 10 },
    panelPerformance: { points: 6, targetYears: 25 },
    inverter: { points: 5, targetYears: 10 },
    workmanship: { points: 3, targetYears: 5 },
  },
  timeline: { fullPointsAtOrBelowDays: 10, zeroPointsAtOrAboveDays: 45 },
  tolerances: { capacityMismatchRatio: 0.1, inverterMinRatio: 0.8 },
  flags: { lowPriceVsMedianRatio: 0.7, capacityFarFromRequestRatio: 0.5 },
  recommendedItems: RECOMMENDED_ITEMS,
  disclaimer: "Comparison score defined by SolarX for guidance only — not a government, official or certification rating.",
} as const;

export type ScoringConfig = typeof scoringConfig;
