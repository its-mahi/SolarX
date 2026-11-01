// Warning and info flags computed by code. Flags never change the score (specs/006 R-05).
import { scoringConfig, type ScoringConfig } from "@/config/scoring.v1";
import { formatInr } from "@/lib/format";
import { detectMissingFields, MISSING_LABELS } from "./missing-fields";
import type { Flag, FlagContext, ScoringInput } from "./types";

/** Ratio comparison robust to float noise (0.1 stays 0.1). */
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function snake(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

export function invalidQuoteFlag(): Flag {
  return { code: "INVALID_QUOTE", severity: "warning", message: "Price or capacity is missing or not positive." };
}

export function computeFlags(input: ScoringInput, context: FlagContext, config: ScoringConfig = scoringConfig): Flag[] {
  const flags: Flag[] = [];

  for (const item of detectMissingFields(input)) {
    flags.push({
      code: `MISSING_${snake(item)}`,
      severity: "warning",
      message: `${MISSING_LABELS[item]}: not stated.`,
      field: item,
    });
  }
  if (input.earthingIncluded === false) {
    flags.push({ code: "EARTHING_NOT_INCLUDED", severity: "warning", message: "Earthing is not included in this quote.", field: "earthing" });
  }
  if (input.documentationIncluded === false) {
    flags.push({ code: "DOCUMENTATION_NOT_INCLUDED", severity: "warning", message: "Documentation is not included in this quote.", field: "documentation" });
  }

  if (input.panel.wattage !== null && input.panel.quantity !== null) {
    const computed = (input.panel.wattage * input.panel.quantity) / 1000;
    const ratio = Math.abs(computed - input.capacityKw) / input.capacityKw;
    if (r6(ratio) > config.tolerances.capacityMismatchRatio) {
      flags.push({
        code: "CAPACITY_MISMATCH",
        severity: "warning",
        message: `Panels add up to ${computed.toFixed(2)} kW but the quote states ${input.capacityKw} kW.`,
        field: "capacity",
      });
    }
  }
  if (input.inverter.capacityKw !== null && r6(input.inverter.capacityKw / input.capacityKw) < config.tolerances.inverterMinRatio) {
    flags.push({
      code: "INVERTER_UNDERSIZED",
      severity: "warning",
      message: `Inverter (${input.inverter.capacityKw} kW) is smaller than 80% of the quoted ${input.capacityKw} kW.`,
      field: "inverter",
    });
  }
  if (context.budget !== null && input.price > context.budget) {
    flags.push({ code: "ABOVE_BUDGET", severity: "info", message: `Price is above your stated budget of ${formatInr(context.budget)}.`, field: "price" });
  }
  if (context.comparedPricesPerKw.length >= 2) {
    const ppk = input.price / input.capacityKw;
    if (r6(ppk / median(context.comparedPricesPerKw)) < config.flags.lowPriceVsMedianRatio) {
      flags.push({ code: "UNUSUALLY_LOW_PRICE", severity: "info", message: "Price per kW is much lower than the other quotes. Ask what is included.", field: "price" });
    }
  }
  if (context.referenceCapacityKw !== null && context.referenceCapacityKw > 0) {
    const ratio = Math.abs(input.capacityKw - context.referenceCapacityKw) / context.referenceCapacityKw;
    if (r6(ratio) > config.flags.capacityFarFromRequestRatio) {
      flags.push({
        code: "CAPACITY_FAR_FROM_REQUEST",
        severity: "info",
        message: `Quoted capacity ${input.capacityKw} kW is far from your ${context.referenceCapacityKw} kW reference.`,
        field: "capacity",
      });
    }
  }
  return flags;
}
