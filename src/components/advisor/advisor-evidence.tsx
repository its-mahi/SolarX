import { AiConfidenceLabel } from "@/components/household/ai-confidence-label";
import { EstimateBadge } from "@/components/shared/estimate-badge";
import type { AdvisorFact } from "@/lib/domain/advisor/types";
import { formatInr, formatKw, formatUnits } from "@/lib/format";

function formatValue(f: AdvisorFact): string {
  const v = f.value;
  if (v === null || v === undefined) return "Not available";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  switch (f.unit) {
    case "inr":
      return formatInr(v);
    case "inr_per_year":
      return `${formatInr(v)} per year`;
    case "inr_per_kwh":
      return `${formatInr(v)} per kWh`;
    case "kw":
      return formatKw(v);
    case "kwh_per_month":
      return `${new Intl.NumberFormat("en-IN").format(v)} kWh per month`;
    case "kwh_per_year":
      return formatUnits(v);
    case "kwh_per_kw_year":
      return `${new Intl.NumberFormat("en-IN").format(v)} kWh per kW per year`;
    case "years":
      return `${v} years`;
    case "days":
      return `${v} days`;
    case "points":
      return `${v} points`;
    default:
      return String(v);
  }
}

/** Evidence chips rendered from the stored facts, never from AI text. */
export function AdvisorEvidence({ factRefs, facts }: { factRefs: string[]; facts: Map<string, AdvisorFact> }) {
  const items = factRefs.map((id) => facts.get(id)).filter((f): f is AdvisorFact => Boolean(f));
  if (items.length === 0) return null;
  return (
    <ul aria-label="Evidence" className="mt-1 flex flex-wrap gap-1.5">
      {items.map((f) => (
        <li key={f.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs">
          <span className="text-muted-foreground">{f.label}:</span>
          {f.kind === "roof_observation" && f.id.endsWith(".confidence") && typeof f.value === "string" ? (
            <AiConfidenceLabel confidence={f.value as "low" | "medium" | "high"} />
          ) : (
            <span className="font-medium">{formatValue(f)}</span>
          )}
          {f.kind === "estimate" && <EstimateBadge kind="estimate" />}
          {f.kind === "vendor_stated" && <EstimateBadge kind="vendor-confirmed" />}
        </li>
      ))}
    </ul>
  );
}
