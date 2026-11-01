"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function RulesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <ErrorState title="We couldn't load the rules" onRetry={reset} />
    </main>
  );
}
