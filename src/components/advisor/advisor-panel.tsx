"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdvisorFact } from "@/lib/domain/advisor/types";
import { advisorExplanationResponseSchema, type AdvisorExplanationResponse } from "@/lib/validation/advisor";
import { AdvisorDisclaimers } from "./advisor-disclaimers";
import { AdvisorSection } from "./advisor-section";

type State =
  | { phase: "loading"; data: AdvisorExplanationResponse | null }
  | { phase: "ready"; data: AdvisorExplanationResponse }
  | { phase: "error"; notFound: boolean };

const FALLBACK_NOTE: Record<string, string> = {
  unavailable: "AI explanation unavailable — showing the standard summary.",
  not_configured: "AI explanation unavailable — showing the standard summary.",
  invalid_output: "AI explanation unavailable — showing the standard summary.",
  rejected: "The AI explanation did not pass our accuracy check — showing the standard summary.",
};

export function AdvisorPanel({ requestId }: { requestId: string }) {
  const [state, setState] = useState<State>({ phase: "loading", data: null });

  const load = useCallback(async () => {
    setState((s) => ({ phase: "loading", data: s.phase === "ready" ? s.data : s.phase === "loading" ? s.data : null }));
    try {
      const res = await fetch("/api/advisor/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (!res.ok) {
        setState({ phase: "error", notFound: res.status === 404 });
        return;
      }
      const json = (await res.json()) as { data?: unknown };
      const parsed = advisorExplanationResponseSchema.safeParse(json.data);
      setState(parsed.success ? { phase: "ready", data: parsed.data } : { phase: "error", notFound: false });
    } catch {
      setState({ phase: "error", notFound: false });
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const data = state.phase === "error" ? null : state.data;
  const facts = useMemo(() => new Map<string, AdvisorFact>((data?.facts ?? []).map((f) => [f.id, f])), [data]);

  if (state.phase === "error") {
    return (
      <div className="space-y-4">
        <ErrorState
          title={state.notFound ? "Request not found" : "We couldn't load the advisor"}
          message={state.notFound ? "This request does not exist, or it belongs to another account." : "Please try again."}
          onRetry={state.notFound ? undefined : () => void load()}
        />
        <Link href="/household" className="text-sm font-medium text-primary underline underline-offset-2">
          Back to your dashboard
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-4">
        <p role="status" className="text-sm text-muted-foreground">
          Preparing your summary…
        </p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <AdvisorDisclaimers />
      </div>
    );
  }

  const busy = state.phase === "loading";
  const compareLink = data.mode === "compare" || data.mode === "needs_comparison";
  const nextHref = compareLink ? `/household/requests/${requestId}/quotes` : `/household/requests/${requestId}`;
  const nextLabel = compareLink ? "Open the quote comparison" : "Back to your request";

  return (
    <div className="space-y-4" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium">
          {data.source === "ai" ? "AI explanation" : "Standard summary"}
        </span>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw aria-hidden className={busy ? "size-4 animate-spin" : "size-4"} />
          Refresh explanation
        </Button>
      </div>

      <div aria-live="polite">
        {data.ai_status !== "used" && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span>{FALLBACK_NOTE[data.ai_status]}</span>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={busy}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {data.quote_labels.length > 0 && (
        <ul aria-label="Quote labels" className="space-y-1 text-sm">
          {data.quote_labels.map((q) => (
            <li key={q.label}>
              <span className="font-medium">Quote {q.label}</span> — {q.vendorDisplayName}
              {q.isDemo ? " (Demo)" : ""}
              {q.status === "accepted" ? " — accepted" : ""}
            </li>
          ))}
        </ul>
      )}

      <AdvisorSection {...data.sections.observed} facts={facts} />
      <AdvisorSection {...data.sections.calculations} facts={facts} />
      <AdvisorSection {...data.sections.recommendation} facts={facts} />

      {data.limitations.length > 0 && (
        <section aria-labelledby="advisor-limitations" className="rounded-xl border border-border bg-card p-4 text-sm">
          <h2 id="advisor-limitations" className="font-semibold">
            Limits of this advice
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      <p>
        <Link href={nextHref} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-2">
          {nextLabel}
        </Link>
      </p>

      <AdvisorDisclaimers disclaimers={data.disclaimers} />
    </div>
  );
}
