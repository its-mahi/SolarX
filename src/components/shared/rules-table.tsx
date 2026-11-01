import { ExternalLink } from "lucide-react";
import type { Rule } from "@/config/rules";
import { cn } from "@/lib/utils";

function formatValue(rule: Rule): string {
  const v = rule.value as unknown;
  if (Array.isArray(v)) {
    return v.map((s: { fromKw: number; toKw: number; ratePerKw: number }) => `${s.fromKw}–${s.toKw} kW: ₹${s.ratePerKw.toLocaleString("en-IN")} per kW`).join("; ");
  }
  if (v && typeof v === "object") {
    const { min, max } = v as { min: number; max: number };
    return `${min} to ${max}`;
  }
  return typeof v === "number" ? v.toLocaleString("en-IN") : String(v);
}

function VerificationBadge({ rule }: { rule: Rule }) {
  const verified = rule.verification === "verified";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        verified ? "border-primary bg-mint text-primary" : "border-highlight bg-highlight/15 text-foreground",
      )}
    >
      {verified ? "Verified" : "Illustrative"}
    </span>
  );
}

function SourceLink({ rule }: { rule: Rule }) {
  return (
    <a
      href={rule.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1 font-medium text-primary underline-offset-4 hover:underline"
    >
      <span>{rule.sourceTitle}</span>
      <ExternalLink aria-hidden className="mt-1 size-3 shrink-0" />
    </a>
  );
}

const dateText = (d: string | null, pending: string) => d ?? pending;

export function RulesTable({ rules }: { rules: Rule[] }) {
  return (
    <>
      {/* Table from md up */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Rules used for every estimate, with their sources</caption>
          <thead className="bg-muted">
            <tr>
              {["Rule", "Value", "Applies to", "Source", "Dates", "Status", "Limitations"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.key} className="border-t align-top">
                <th scope="row" className="px-3 py-3 font-medium">
                  {rule.name}
                </th>
                <td className="px-3 py-3">
                  {formatValue(rule)} <span className="text-muted-foreground">{rule.unit}</span>
                </td>
                <td className="px-3 py-3">
                  {rule.consumerCategory}
                  <br />
                  <span className="text-muted-foreground">{rule.geography}</span>
                </td>
                <td className="px-3 py-3">
                  <SourceLink rule={rule} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  Effective: {dateText(rule.effectiveDate, "Pending verification")}
                  <br />
                  Retrieved: {dateText(rule.retrievedOn, "Pending verification")}
                </td>
                <td className="px-3 py-3">
                  <VerificationBadge rule={rule} />
                </td>
                <td className="px-3 py-3">
                  <ul className="list-disc space-y-1 pl-4">
                    {rule.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards on mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rules.map((rule) => (
          <li key={rule.key} className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{rule.name}</h3>
              <VerificationBadge rule={rule} />
            </div>
            <p className="text-base font-medium">
              {formatValue(rule)} <span className="text-sm font-normal text-muted-foreground">{rule.unit}</span>
            </p>
            <p>
              {rule.consumerCategory} · <span className="text-muted-foreground">{rule.geography}</span>
            </p>
            <SourceLink rule={rule} />
            <p className="text-muted-foreground">
              Effective: {dateText(rule.effectiveDate, "Pending verification")} · Retrieved: {dateText(rule.retrievedOn, "Pending verification")}
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {rule.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
