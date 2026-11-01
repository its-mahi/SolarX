// Normalizes a stored quote row defensively and projects the structured scoring input (specs/006 R-02, R-03).
import {
  asRecord,
  parseBoolean,
  parseCapacityKw,
  parseCertifications,
  parseInstallationDays,
  parseQuantity,
  parseText,
  parseWarrantyYears,
  parseWattage,
} from "@/lib/validation/quote-review";
import type { NormalizedQuote, QuoteRowLike, QuoteStatusValue, ScoringInput } from "./types";

const STATUSES: QuoteStatusValue[] = ["submitted", "accepted", "rejected", "withdrawn"];

function finitePositive(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

function displayText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, max);
}

export function normalizeQuote(row: QuoteRowLike): NormalizedQuote {
  const panel = asRecord(row.panel_details);
  const inverter = asRecord(row.inverter_details);
  const warranty = asRecord(row.warranty_details);

  const price = typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null;
  const capacityKw = finitePositive(row.capacity_kw);
  const wattage = parseWattage(panel.wattage);
  const quantity = parseQuantity(panel.quantity);

  const inclusions = Array.isArray(row.other_inclusions)
    ? row.other_inclusions.filter((i): i is string => typeof i === "string" && i.trim() !== "").map((i) => i.trim())
    : [];

  return {
    quoteId: row.id,
    requestId: row.request_id,
    vendorId: row.vendor_id,
    status: STATUSES.includes(row.status as QuoteStatusValue) ? (row.status as QuoteStatusValue) : "submitted",
    submittedAt: row.created_at,
    price,
    capacityKw,
    pricePerKw: price !== null && price > 0 && capacityKw !== null ? Math.round(price / capacityKw) : null,
    panel: {
      brand: parseText(panel.brand),
      model: parseText(panel.model),
      wattage,
      quantity,
      certifications: parseCertifications(panel.certifications),
      computedCapacityKw: wattage !== null && quantity !== null ? (wattage * quantity) / 1000 : null,
    },
    inverter: {
      brand: parseText(inverter.brand),
      model: parseText(inverter.model),
      type: parseText(inverter.type),
      capacityKw: parseCapacityKw(inverter.capacity_kw),
    },
    warranty: {
      panelProductYears: parseWarrantyYears(warranty.panel_product_years),
      panelPerformanceYears: parseWarrantyYears(warranty.performance_years),
      inverterYears: parseWarrantyYears(warranty.inverter_years),
      workmanshipYears: parseWarrantyYears(warranty.workmanship_years),
    },
    installationDays: parseInstallationDays(row.installation_days),
    earthingIncluded: parseBoolean(row.earthing_included),
    documentationIncluded: parseBoolean(row.documentation_included),
    vendorText: {
      otherInclusions: inclusions.length > 0 ? inclusions : null,
      exclusions: displayText(row.exclusions, 2000),
      notes: displayText(row.vendor_notes, 2000),
    },
    source: row.source === "ai_extracted" ? "ai_extracted" : "manual",
  };
}

/** Structured fields only. Throws if called for a quote that fails required-field validation. */
export function toScoringInput(n: NormalizedQuote): ScoringInput {
  if (n.price === null || n.price <= 0 || n.capacityKw === null || n.capacityKw <= 0) {
    throw new Error("toScoringInput requires a quote with a positive price and capacity");
  }
  return {
    quoteId: n.quoteId,
    submittedAt: n.submittedAt,
    price: n.price,
    capacityKw: n.capacityKw,
    panel: { brand: n.panel.brand, wattage: n.panel.wattage, quantity: n.panel.quantity, certifications: n.panel.certifications },
    inverter: { brand: n.inverter.brand, type: n.inverter.type, capacityKw: n.inverter.capacityKw },
    warranty: {
      panelProduct: n.warranty.panelProductYears,
      panelPerformance: n.warranty.panelPerformanceYears,
      inverter: n.warranty.inverterYears,
      workmanship: n.warranty.workmanshipYears,
    },
    installationDays: n.installationDays,
    earthingIncluded: n.earthingIncluded,
    documentationIncluded: n.documentationIncluded,
  };
}
