// Standard comparison rows shared by the card and the table: same order, same markers, "Not stated" for unknowns.
import { formatInr } from "@/lib/format";
import type { ComparedQuoteView } from "./comparison-types";

export type FieldRow = {
  key: string;
  label: string;
  /** null renders as "Not stated" (never 0). */
  value: string | null;
  marker: "vendor-confirmed" | "estimate";
};

const yearsText = (y: number | null) => (y === null ? null : y === 0 ? "No warranty" : `${y} ${y === 1 ? "year" : "years"}`);
const yesNo = (v: boolean | null) => (v === null ? null : v ? "Included" : "Not included");

export function buildFieldRows(q: ComparedQuoteView): FieldRow[] {
  const n = q.normalized;
  const panelName = [n.panel.brand, n.panel.model].filter(Boolean).join(" ") || null;
  const panelSize = n.panel.wattage !== null && n.panel.quantity !== null ? `${n.panel.quantity} × ${n.panel.wattage} W` : null;
  const invName = [n.inverter.brand, n.inverter.model].filter(Boolean).join(" ") || null;
  const invDetail = [n.inverter.type, n.inverter.capacityKw !== null ? `${n.inverter.capacityKw} kW` : null].filter(Boolean).join(", ") || null;
  const vc = "vendor-confirmed" as const;
  return [
    { key: "price", label: "Quoted price", value: n.price === null ? null : formatInr(n.price), marker: vc },
    { key: "ppk", label: "Price per kW", value: n.pricePerKw === null ? null : formatInr(n.pricePerKw), marker: vc },
    { key: "capacity", label: "System capacity", value: n.capacityKw === null ? null : `${n.capacityKw} kW`, marker: vc },
    { key: "panels", label: "Panels", value: [panelName, panelSize].filter(Boolean).join(" · ") || null, marker: vc },
    { key: "certs", label: "Panel certifications", value: n.panel.certifications?.join(", ") ?? null, marker: vc },
    { key: "inverter", label: "Inverter", value: [invName, invDetail].filter(Boolean).join(" · ") || null, marker: vc },
    { key: "w-product", label: "Panel product warranty", value: yearsText(n.warranty.panelProductYears), marker: vc },
    { key: "w-perf", label: "Panel performance warranty", value: yearsText(n.warranty.panelPerformanceYears), marker: vc },
    { key: "w-inv", label: "Inverter warranty", value: yearsText(n.warranty.inverterYears), marker: vc },
    { key: "w-work", label: "Workmanship warranty", value: yearsText(n.warranty.workmanshipYears), marker: vc },
    { key: "days", label: "Installation time", value: n.installationDays === null ? null : `${n.installationDays} days`, marker: vc },
    { key: "earthing", label: "Earthing", value: yesNo(n.earthingIncluded), marker: vc },
    { key: "docs", label: "Documentation", value: yesNo(n.documentationIncluded), marker: vc },
    { key: "subsidy", label: "Estimated central subsidy", value: q.platformEstimates ? formatInr(q.platformEstimates.subsidyEstimate) : null, marker: "estimate" },
    { key: "net", label: "Estimated net cost", value: q.platformEstimates ? formatInr(q.platformEstimates.netCostEstimate) : null, marker: "estimate" },
  ];
}
