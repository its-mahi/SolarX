"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { canWithdrawQuote } from "@/lib/domain/quotes/lifecycle";
import type { RequestStatus } from "@/lib/validation/enums";
import type { VendorQuoteHistoryItem } from "@/lib/validation/quote";
import { QuoteStatusBadge } from "./quote-status-badge";
import { QuoteSummary } from "./quote-summary";
import { WithdrawQuoteDialog } from "./withdraw-quote-dialog";

/** Quote area for a vendor's request detail: submit link, or the active quote with withdraw. */
export function VendorQuotePanel({ requestId, requestStatus }: { requestId: string; requestStatus: RequestStatus }) {
  const [active, setActive] = useState<VendorQuoteHistoryItem | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/quotes/mine?request_id=${encodeURIComponent(requestId)}`);
      if (!res.ok) throw new Error("load");
      const json = (await res.json()) as { data: { items: VendorQuoteHistoryItem[] } };
      setActive(json.data.items.find((q) => q.status === "submitted" || q.status === "accepted") ?? null);
    } catch {
      setFailed(true);
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void load();
  }, [load]);

  const quotable = requestStatus === "open" || requestStatus === "quoted";
  if (failed) return <ErrorState title="Could not load your quote" onRetry={() => void load()} />;
  if (active === undefined) return <LoadingState variant="card" label="Loading your quote" />;

  if (active) {
    return (
      <section aria-labelledby="active-quote-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="active-quote-title" className="text-lg font-semibold">
            Your active quote
          </h2>
          <QuoteStatusBadge status={active.status} />
        </div>
        <QuoteSummary quote={active} />
        {canWithdrawQuote(active.status) ? (
          <>
            <Button variant="outline" className="self-start" onClick={() => setWithdrawing(true)}>
              Withdraw quote
            </Button>
            <WithdrawQuoteDialog
              open={withdrawing}
              onOpenChange={setWithdrawing}
              quoteId={active.id}
              onWithdrawn={() => {
                setActive(null);
              }}
            />
          </>
        ) : null}
      </section>
    );
  }

  if (!quotable) return <p className="text-sm text-muted-foreground">This request is no longer accepting quotes.</p>;
  return (
    <Button asChild size="lg" className="self-start">
      <Link href={`/vendor/requests/${requestId}/quote`}>Submit a quote</Link>
    </Button>
  );
}
