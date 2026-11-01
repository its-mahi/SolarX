"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function QuotesError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load quotes" message="Please try again." onRetry={reset} />;
}
