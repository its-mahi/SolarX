"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HouseholdRequestDto } from "@/lib/validation/requests";

type Counts = { total: number; active: number; withdrawn: number };
type Loaded = { counts: Counts; acceptedVendor: string | null };

/** Body of RequestQuotesSlot (owner: 006): quote count and a link to the comparison page. */
export function QuotesSlotBody({ request, variant }: { request: HouseholdRequestDto; variant: "detail" | "card" }) {
  const [loaded, setLoaded] = useState<Loaded | null | "error">(null);
  const isDraft = request.status === "draft";

  useEffect(() => {
    if (isDraft) return;
    let cancelled = false;
    fetch(`/api/requests/${request.id}/quotes`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return "error" as const;
        const json = (await res.json()) as { data?: { counts?: Counts; acceptance?: { vendor?: { companyName?: string } } | null } };
        if (!json.data?.counts) return "error" as const;
        return { counts: json.data.counts, acceptedVendor: json.data.acceptance?.vendor?.companyName ?? null } satisfies Loaded;
      })
      .catch(() => "error" as const)
      .then((c) => {
        if (!cancelled) setLoaded(c);
      });
    return () => {
      cancelled = true;
    };
  }, [request.id, isDraft]);

  if (isDraft || loaded === "error") return null;
  const counts = loaded === null ? null : loaded.counts;
  const acceptedVendor = loaded === null ? null : loaded.acceptedVendor;
  const href = `/household/requests/${request.id}/quotes`;
  const label = counts === null ? "Checking for quotes…" : counts.active === 0 ? "No quotes yet" : `${counts.active} ${counts.active === 1 ? "quote" : "quotes"} received`;

  if (variant === "card" && acceptedVendor) {
    // 007: once a quote is accepted the card says so and points to the next steps.
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="quotes-slot-card">
        <span className="font-medium">Accepted — {acceptedVendor}</span>
        <Link href={`/household/requests/${request.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
          View next steps
        </Link>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="quotes-slot-card">
        <span className="font-medium">{label}</span>
        {counts !== null && counts.active > 0 ? (
          <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
            Compare quotes
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <section aria-labelledby="quotes-h" className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="quotes-slot-detail">
      <h2 id="quotes-h" className="font-semibold">
        Quotes
      </h2>
      <p className="text-sm text-muted-foreground">{label}</p>
      {counts !== null && counts.active > 0 ? (
        <Button asChild size="lg" className="w-fit">
          <Link href={href}>Compare quotes</Link>
        </Button>
      ) : null}
    </section>
  );
}
