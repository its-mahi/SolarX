// Fixed plain-English labels for 006 missing-item keys and flag codes (specs/011 T005).
// Raw vendor text is never echoed; unknown keys become "other detail".
const MISSING: Record<string, string> = {
  panelBrand: "panel brand",
  panelWattage: "panel wattage",
  panelQuantity: "number of panels",
  panelCertifications: "panel certifications",
  inverterBrand: "inverter brand",
  inverterType: "inverter type",
  inverterCapacity: "inverter capacity",
  warrantyPanelProduct: "panel product warranty",
  warrantyPanelPerformance: "panel performance warranty",
  warrantyInverter: "inverter warranty",
  warrantyWorkmanship: "workmanship warranty",
  installationDays: "installation time",
  earthingStated: "earthing",
  documentationStated: "documentation",
};

const FLAGS: Record<string, string> = {
  ABOVE_BUDGET: "price above your budget",
  CAPACITY_FAR_FROM_REQUEST: "capacity far from your request",
  CAPACITY_MISMATCH: "panel and quote capacity do not match",
  DOCUMENTATION_NOT_INCLUDED: "documentation not included",
  EARTHING_NOT_INCLUDED: "earthing not included",
  INVALID_QUOTE: "price or capacity missing",
  INVERTER_UNDERSIZED: "inverter looks undersized",
  MISSING_EARTHING_STATED: "earthing not stated",
  MISSING_WARRANTY_WORKMANSHIP: "workmanship warranty not stated",
  UNUSUALLY_LOW_PRICE: "unusually low price",
};

const OTHER = "other detail";

export function plainMissingLabel(key: string): string {
  return Object.prototype.hasOwnProperty.call(MISSING, key) ? MISSING[key] : OTHER;
}

export function plainFlagLabel(code: string): string {
  return Object.prototype.hasOwnProperty.call(FLAGS, code) ? FLAGS[code] : OTHER;
}

/** Unique, order-preserving plain labels joined for display. */
export function plainList(labels: string[]): string {
  return [...new Set(labels)].join(", ");
}
