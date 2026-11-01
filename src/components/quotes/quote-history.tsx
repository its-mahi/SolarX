"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { Button } from "@/components/ui/button";
import { canWithdrawQuote } from "@/lib/domain/quotes/lifecycle";
import { formatDate, formatInr } from "@/lib/format";
import type { VendorQuoteHistoryItem } from "@/lib/validation/quote";
import { AcceptedQuoteContact } from "./accepted-quote-contact";
import { QuoteOutcomeNotice } from "./quote-outcome-notice";
import { QuoteStatusBadge } from "./quote-status-badge";
import { QuoteSummary } from "./quote-summary";
import { WithdrawQuoteDialog } from "./withdraw-quote-dialog";

export function QuoteHistory() {
  const [items, setItems] = useState<VendorQuoteHistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/quotes/mine", { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const json = (await res.json()) as { data: { items: VendorQuoteHistoryItem[] } };
      setItems(json.data.items);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void load();
  }, [load]);

  if (failed) return <ErrorState title="Could not load your quotes" onRetry={() => void load()} />;
  if (!items) return <LoadingState label="Loading your quotes" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="You have not sent any quotes yet"
        description="Open a household request and send a structured quote."
        action={{ label: "Browse open requests", href: "/vendor" }}
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((q) => (
          <li key={q.id} className="rounded-xl border bg-card p-4" data-testid="quote-history-item">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{q.request.locality || "Household request"}</span>
                <span className="text-xs text-muted-foreground">Sent {formatDate(q.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RequestStatusBadge status={q.request.status} />
                <QuoteStatusBadge status={q.status} />
              </div>
            </div>
            <p className="mt-2 text-sm">
              {formatInr(q.price)} · {q.capacity_kw} kW · {q.installation_days} days
            </p>
            <div className="mt-2">
              <QuoteOutcomeNotice status={q.status} />
            </div>
            {q.status === "accepted" ? (
              <div className="mt-3">
                <AcceptedQuoteContact quoteId={q.id} status={q.status} />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-expanded={open === q.id}
                onClick={() => setOpen(open === q.id ? null : q.id)}
              >
                {open === q.id ? "Hide details" : "View details"}
              </Button>
              {canWithdrawQuote(q.status) ? (
                <Button variant="outline" size="sm" onClick={() => setWithdrawId(q.id)}>
                  Withdraw
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="sm">
                <Link href={`/vendor/requests/${q.request_id}`}>View request</Link>
              </Button>
            </div>
            {open === q.id ? (
              <div className="mt-4 border-t pt-4">
                <QuoteSummary quote={q} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {withdrawId ? (
        <WithdrawQuoteDialog
          open
          onOpenChange={(o) => {
            if (!o) setWithdrawId(null);
          }}
          quoteId={withdrawId}
          onWithdrawn={() => {
            setWithdrawId(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}
