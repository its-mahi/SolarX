"use client";

// Comparison page body with spec 007's Accept button in every quote card (T015).
// A client wrapper is needed because the server page cannot pass a render function.
import { useState } from "react";
import { acceptButtonProps } from "@/lib/domain/requests/accept-button-props";
import { AcceptQuoteButton } from "./accept-quote-button";
import type { ComparisonData, ComparedQuoteView } from "./comparison-types";
import { QuoteComparisonView } from "./quote-comparison-view";

export function ComparisonWithAccept({ requestId }: { requestId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const renderAction = (quote: ComparedQuoteView, data: ComparisonData) => (
    <AcceptQuoteButton
      {...acceptButtonProps(
        data.requestStatus,
        {
          id: quote.quoteId,
          status: quote.status,
          price: quote.normalized.price ?? 0,
          capacityKw: quote.normalized.capacityKw ?? 0,
          vendorName: quote.vendor.companyName,
        },
        data.compared.map((q) => ({ id: q.quoteId, status: q.status })),
        quote.platformEstimates?.netCostEstimate ?? null,
      )}
      onChanged={() => setRefreshKey((k) => k + 1)}
    />
  );

  return <QuoteComparisonView requestId={requestId} renderAction={renderAction} refreshKey={refreshKey} />;
}
