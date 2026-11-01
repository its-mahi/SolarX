import type { ReactNode } from "react";
import { EstimateBadge } from "@/components/shared/estimate-badge";
import { MISSING_LABELS } from "@/lib/domain/quotes/missing-fields";
import type { ComparedQuoteView } from "./comparison-types";
import { buildFieldRows } from "./quote-fields";

type Props = { quotes: ComparedQuoteView[]; renderAction?: (q: ComparedQuoteView) => ReactNode };

export function QuoteComparisonTable({ quotes, renderAction }: Props) {
  const rowsByQuote = quotes.map(buildFieldRows);
  const labels = rowsByQuote[0] ?? [];
  const th = "sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-medium text-muted-foreground";
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">Quote comparison, one column per quote</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className={th}>
              Field
            </th>
            {quotes.map((q) => (
              <th key={q.quoteId} scope="col" className="px-3 py-2 text-left align-top">
                {q.vendor.companyName}
                <span className="block text-xs font-normal text-muted-foreground">
                  Rank {q.rank}
                  {q.tied ? " (tied)" : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <th scope="row" className={th}>
              Comparison score
            </th>
            {quotes.map((q) => (
              <td key={q.quoteId} className="px-3 py-2 font-semibold">
                {q.totalScore.toFixed(1)} / 100
              </td>
            ))}
          </tr>
          {(["price", "technical", "warranty", "completeness", "timeline"] as const).map((part) => (
            <tr key={part} className="border-b">
              <th scope="row" className={th}>
                Score: {part}
              </th>
              {quotes.map((q) => (
                <td key={q.quoteId} className="px-3 py-2">
                  {q.scoreBreakdown.parts[part].points} / {q.scoreBreakdown.parts[part].max}
                </td>
              ))}
            </tr>
          ))}
          {labels.map((row, i) => (
            <tr key={row.key} className="border-b">
              <th scope="row" className={th}>
                {row.label}
              </th>
              {rowsByQuote.map((rows, c) => (
                <td key={quotes[c].quoteId} className="px-3 py-2">
                  {rows[i].value === null ? (
                    <span className="italic text-muted-foreground">Not stated</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {rows[i].value}
                      <EstimateBadge kind={rows[i].marker} />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-b">
            <th scope="row" className={th}>
              Flags
            </th>
            {quotes.map((q) => (
              <td key={q.quoteId} className="px-3 py-2 align-top">
                {q.missingFields.length === 0 && q.flags.length === 0 ? (
                  "None"
                ) : (
                  <ul className="list-disc pl-4">
                    {q.missingFields.map((m) => (
                      <li key={m}>{MISSING_LABELS[m]}: not stated</li>
                    ))}
                    {q.flags
                      .filter((f) => !f.code.startsWith("MISSING_"))
                      .map((f) => (
                        <li key={f.code}>{f.message}</li>
                      ))}
                  </ul>
                )}
              </td>
            ))}
          </tr>
          {renderAction ? (
            <tr>
              <th scope="row" className={th}>
                Action
              </th>
              {quotes.map((q) => (
                <td key={q.quoteId} className="px-3 py-2">
                  {renderAction(q)}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
