"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <ErrorState onRetry={reset} />
    </main>
  );
}
