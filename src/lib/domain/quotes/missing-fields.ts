import { RECOMMENDED_ITEMS, type RecommendedItem } from "@/config/scoring.v1";
import type { ScoringInput } from "./types";

const STATED: Record<RecommendedItem, (q: ScoringInput) => boolean> = {
  panelBrand: (q) => q.panel.brand !== null,
  panelWattage: (q) => q.panel.wattage !== null,
  panelQuantity: (q) => q.panel.quantity !== null,
  panelCertifications: (q) => q.panel.certifications !== null && q.panel.certifications.length > 0,
  inverterBrand: (q) => q.inverter.brand !== null,
  inverterType: (q) => q.inverter.type !== null,
  inverterCapacity: (q) => q.inverter.capacityKw !== null,
  warrantyPanelProduct: (q) => q.warranty.panelProduct !== null,
  warrantyPanelPerformance: (q) => q.warranty.panelPerformance !== null,
  warrantyInverter: (q) => q.warranty.inverter !== null,
  warrantyWorkmanship: (q) => q.warranty.workmanship !== null,
  installationDays: (q) => q.installationDays !== null,
  earthingStated: (q) => q.earthingIncluded !== null,
  documentationStated: (q) => q.documentationIncluded !== null,
};

/** Recommended items the vendor did not state, in the fixed order. `false` and `0` count as stated. */
export function detectMissingFields(q: ScoringInput): RecommendedItem[] {
  return RECOMMENDED_ITEMS.filter((item) => !STATED[item](q));
}

export const MISSING_LABELS: Record<RecommendedItem, string> = {
  panelBrand: "Panel brand",
  panelWattage: "Panel wattage",
  panelQuantity: "Panel quantity",
  panelCertifications: "Panel certifications",
  inverterBrand: "Inverter brand",
  inverterType: "Inverter type",
  inverterCapacity: "Inverter capacity",
  warrantyPanelProduct: "Panel product warranty",
  warrantyPanelPerformance: "Panel performance warranty",
  warrantyInverter: "Inverter warranty",
  warrantyWorkmanship: "Workmanship warranty",
  installationDays: "Installation timeline",
  earthingStated: "Earthing",
  documentationStated: "Documentation",
};
