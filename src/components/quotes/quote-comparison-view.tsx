"use client";

import { useCallback, useEffect, useState } from "react";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComparisonData, RenderQuoteAction } from "./comparison-types";
import { QuoteCard } from "./quote-card";
import { QuoteComparisonTable } from "./quote-comparison-table";
import { ScoringDisclaimer } from "./scoring-disclaimer";

type Props = {
  requestId: string;
  /** Spec 007 fills each card's `actionSlot` (accept button) through this. */
  renderAction?: RenderQuoteAction;
  /** Increment to re-run the comparison (e.g. after an acceptance). */
  refreshKey?: number;
};

type State = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; data: ComparisonData };

async function runCompare(requestId: string): Promise<State> {
  try {
    const res = await fetch("/api/quotes/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
      cache: "no-store",
    });
    if (res.status === 404) return { status: "error", notFound: true };
    if (!res.ok) return { status: "error", notFound: false };
    const json = (await res.json()) as { data?: ComparisonData };
    return json.data ? { status: "ready", data: json.data } : { status: "error", notFound: false };
  } catch {
    return { status: "error", notFound: false };
  }
}

export function QuoteComparisonView({ requestId, renderAction, refreshKey = 0 }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [layout, setLayout] = useState<"cards" | "table">("cards");

  useEffect(() => {
    let cancelled = false;
    runCompare(requestId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [requestId, refreshKey]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    runCompare(requestId).then(setState);
  }, [requestId]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Loading quotes" className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (state.status === "error") {
    return state.notFound ? (
      <EmptyState icon={FileQuestion} title="Request not found" description="This request does not exist or is not yours." action={{ label: "Back to dashboard", href: "/household" }} />
    ) : (
      <ErrorState title="Couldn't load quotes" message="Please try again." onRetry={retry} />
    );
  }

  const { data } = state;
  const withdrawn = data.excluded.filter((e) => e.reason === "withdrawn");
  const incomplete = data.excluded.filter((e) => e.reason === "invalid");

  if (data.compared.length === 0 && data.excluded.length === 0) {
    return <EmptyState icon={FileQuestion} title="No quotes yet" description="Vendors near you can see your request; you'll see quotes here." />;
  }

  const action = (q: ComparisonData["compared"][number]) => renderAction?.(q, data);

  return (
    <div className="flex flex-col gap-4">
      <ScoringDisclaimer weights={data.weights} version={data.scoringVersion} disclaimer={data.disclaimer} />
      {data.requestStatus === "accepted" || data.requestStatus === "closed" ? (
        <p className="text-sm text-muted-foreground">This request is {data.requestStatus}. Quotes are shown for reference.</p>
      ) : null}

      {data.compared.length === 0 ? (
        <EmptyState icon={FileQuestion} title="No active quotes" description="Every quote on this request was withdrawn or is incomplete." />
      ) : (
        <>
          <div className="hidden items-center gap-2 md:flex" role="group" aria-label="Layout">
            <Button type="button" variant={layout === "cards" ? "default" : "outline"} aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}>
              Cards
            </Button>
            <Button type="button" variant={layout === "table" ? "default" : "outline"} aria-pressed={layout === "table"} onClick={() => setLayout("table")}>
              Table
            </Button>
          </div>
          <div className={layout === "table" ? "grid gap-4 md:hidden" : "grid gap-4 lg:grid-cols-2"}>
            {data.compared.map((q) => (
              <QuoteCard key={q.quoteId} quote={q} comparedCount={data.compared.length} ruleVersion={data.ruleVersion} actionSlot={action(q)} />
            ))}
          </div>
          {layout === "table" ? (
            <div className="hidden md:block">
              <QuoteComparisonTable quotes={data.compared} renderAction={renderAction ? action : undefined} />
            </div>
          ) : null}
        </>
      )}

      {data.excluded.length > 0 ? (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Not compared ({data.excluded.length})</summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {withdrawn.length > 0 ? <li>{withdrawn.length} withdrawn by vendor</li> : null}
            {incomplete.length > 0 ? <li>{incomplete.length} incomplete (price or capacity missing)</li> : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
