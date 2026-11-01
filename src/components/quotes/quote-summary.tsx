import type { ReactNode } from "react";
import { formatInr } from "@/lib/format";
import type { QuoteRecord } from "@/lib/validation/quote";

const NS = "Not specified";
const yrs = (v: number | null | undefined) => (v === null || v === undefined ? NS : `${v} years`);
const txt = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? NS : String(v));
const tri = (v: boolean | null) => (v === null ? NS : v ? "Included" : "Not included");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

/** Read-only quote. Vendor free text is rendered as plain React text only. */
export function QuoteSummary({ quote }: { quote: QuoteRecord }) {
  const p = quote.panel_details;
  const i = quote.inverter_details;
  const w = quote.warranty_details;
  const panel = [p.brand, p.model].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor-stated values</p>
      <dl className="flex flex-col gap-2">
        <Row label="Total price">{formatInr(quote.price)}</Row>
        <Row label="System capacity">{quote.capacity_kw} kW</Row>
        <Row label="Panels">
          {panel || NS}
          {p.wattage ? `, ${p.wattage} Wp` : ""}
          {p.quantity ? ` × ${p.quantity}` : ""}
        </Row>
        <Row label="Panel technology">{txt(p.technology)}</Row>
        <Row label="Panel certifications">{p.certifications.length ? p.certifications.join(", ") : NS}</Row>
        <Row label="Inverter">
          {[i.brand, i.model].filter(Boolean).join(" ") || NS}
          {i.type ? `, ${i.type}` : ""}
          {i.capacity_kw ? `, ${i.capacity_kw} kW` : ""}
        </Row>
        <Row label="Panel product warranty">{yrs(w.panel_product_years)}</Row>
        <Row label="Panel performance warranty">{yrs(w.performance_years)}</Row>
        <Row label="Inverter warranty">{yrs(w.inverter_years)}</Row>
        <Row label="Workmanship warranty">{yrs(w.workmanship_years)}</Row>
        <Row label="Installation time">{quote.installation_days} days</Row>
        <Row label="Earthing">{tri(quote.earthing_included)}</Row>
        <Row label="Documentation and paperwork">{tri(quote.documentation_included)}</Row>
        <Row label="Other inclusions">{quote.other_inclusions.length ? quote.other_inclusions.join("; ") : NS}</Row>
        <Row label="Exclusions">{txt(quote.exclusions)}</Row>
        <Row label="Taxes, payment milestones and other terms">{txt(quote.vendor_notes)}</Row>
      </dl>
    </div>
  );
}
