import type { ReactNode } from "react";
import Link from "next/link";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EstimateBadge } from "@/components/shared/estimate-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparedQuoteView } from "./comparison-types";
import { buildFieldRows } from "./quote-fields";
import { QuoteFlags } from "./quote-flags";
import { ScoreBreakdown } from "./score-breakdown";
import { SourceDocumentButton } from "./source-document-viewer";

type Props = {
  quote: ComparedQuoteView;
  comparedCount: number;
  ruleVersion: string;
  /** Filled by spec 007 with the accept button / outcome status. */
  actionSlot?: ReactNode;
};

export function QuoteCard({ quote, comparedCount, ruleVersion, actionSlot }: Props) {
  const rows = buildFieldRows(quote);
  const text = quote.normalized.vendorText;
  const hasVendorText = Boolean(text.otherInclusions || text.exclusions || text.notes);
  return (
    <Card data-testid="quote-card" data-quote-id={quote.quoteId} className="min-w-0">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border px-2 py-0.5">
            {comparedCount === 1 ? "Only quote" : `Rank ${quote.rank} of ${comparedCount}`}
          </span>
          {quote.tied ? <span className="rounded-full border px-2 py-0.5">Tied score</span> : null}
          {quote.rank === 1 && comparedCount > 1 ? <span className="rounded-full bg-mint px-2 py-0.5 text-primary">Highest comparison score</span> : null}
        </div>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          {quote.vendor.companyName}
          {quote.vendor.isDemo ? <DemoBadge /> : null}
        </CardTitle>
        <p className="text-2xl font-semibold" data-testid="quote-score">
          {quote.totalScore.toFixed(1)} <span className="text-base font-normal text-muted-foreground">/ 100</span>
        </p>
        <p className="text-sm text-muted-foreground">{quote.explanation}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ScoreBreakdown breakdown={quote.scoreBreakdown} />
        <dl className="flex flex-col">
          {rows.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="flex flex-wrap items-center gap-2 break-words">
                {r.value === null ? (
                  <span className="text-sm italic text-muted-foreground">Not stated</span>
                ) : (
                  <>
                    <span className="font-medium">{r.value}</span>
                    <EstimateBadge kind={r.marker} />
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Estimates use rule set {ruleVersion}. See the{" "}
          <Link href="/rules" className="underline">
            rules
          </Link>
          .
        </p>
        <QuoteFlags missingFields={quote.missingFields} flags={quote.flags} />
        {hasVendorText ? (
          <section aria-label="As stated by the vendor" className="rounded-lg bg-muted/50 p-3 text-sm">
            <h3 className="font-medium">As stated by the vendor</h3>
            {text.otherInclusions ? <p className="break-words">Also included: {text.otherInclusions.join(", ")}</p> : null}
            {text.exclusions ? <p className="break-words">Not included: {text.exclusions}</p> : null}
            {text.notes ? <p className="break-words">Notes: {text.notes}</p> : null}
          </section>
        ) : null}
        {quote.normalized.source === "ai_extracted" ? (
          // 009: neutral provenance note. It never affects the score, the order or any ranking emphasis.
          <div data-testid="quote-source-marker" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span>AI-extracted from vendor document</span>
            <SourceDocumentButton quoteId={quote.quoteId} />
          </div>
        ) : null}
        {actionSlot ? <div data-testid="quote-action-slot">{actionSlot}</div> : null}
      </CardContent>
    </Card>
  );
}
