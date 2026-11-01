import { ExternalLink } from "lucide-react";
import type { Rule } from "@/config/rules";

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

export function RulesTable({ rules }: { rules: Rule[] }) {
  return (
    <>
      {/* Table from md up */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Rules used for every estimate, with their sources</caption>
          <thead className="bg-muted">
            <tr>
              {["Rule", "Value", "Applies to", "Source"].map((h) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards on mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rules.map((rule) => (
          <li key={rule.key} className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
            <h3 className="font-semibold">{rule.name}</h3>
            <p className="text-base font-medium">
              {formatValue(rule)} <span className="text-sm font-normal text-muted-foreground">{rule.unit}</span>
            </p>
            <p>
              {rule.consumerCategory} · <span className="text-muted-foreground">{rule.geography}</span>
            </p>
            <SourceLink rule={rule} />
          </li>
        ))}
      </ul>
    </>
  );
}
