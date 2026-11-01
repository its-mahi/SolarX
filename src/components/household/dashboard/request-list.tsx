"use client";

import { useCallback, useEffect, useState } from "react";
import { Sun } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import { RequestCard } from "./request-card";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: HouseholdRequestDto[] };

/** Fetches the caller's requests from GET /api/requests; loading, empty, error (with retry) and list states. */
export function RequestList() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/requests", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.items) throw new Error("failed");
      setState({ kind: "ready", items: json.data.items });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Loading your requests" className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <span className="sr-only">Loading your requests…</span>
      </div>
    );
  }
  if (state.kind === "error") {
    return <ErrorState title="We couldn't load your requests" message="Please check your connection and try again." onRetry={load} />;
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={Sun}
        title="Create your solar request"
        description="Tell us about your roof and electricity use. Vendors then send you quotes to compare."
        action={{ label: "New request", href: "/household/requests/new" }}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {state.items.map((item) => (
        <li key={item.id}>
          <RequestCard request={item} />
        </li>
      ))}
    </ul>
  );
}
