"use client";

import { useCallback, useEffect, useState } from "react";
import { DemoBadge } from "@/components/shared/demo-badge";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { VendorQuotePanel } from "@/components/quotes/vendor-quote-panel";
import type { VendorRequestDetail } from "@/lib/validation/vendor-discovery";
import { formatDistance, formatInr, formatKw, formatPosted } from "./format";
import { PrivacyNotice } from "./privacy-notice";
import { RoofAssessmentSummary } from "./roof-assessment-summary";

type State = { kind: "loading" } | { kind: "notfound" } | { kind: "error" } | { kind: "ready"; detail: VendorRequestDetail };

export function RequestDetail({ requestId }: { requestId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, { cache: "no-store" });
      if (res.status === 404 || res.status === 400) return setState({ kind: "notfound" });
      if (!res.ok) return setState({ kind: "error" });
      const json = (await res.json()) as { data: VendorRequestDetail };
      setState({ kind: "ready", detail: json.data });
    } catch {
      setState({ kind: "error" });
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/param change
    void load();
  }, [load]);

  const retry = () => {
    setState({ kind: "loading" });
    void load();
  };

  if (state.kind === "loading") return <LoadingState label="Loading request…" />;
  if (state.kind === "notfound") return <ErrorState title="This request is no longer available" message="It may have been accepted or closed by the household." />;
  if (state.kind === "error") return <ErrorState onRetry={retry} />;
  const d = state.detail;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{d.locality ?? "Locality not provided"}</h1>
        {d.is_demo ? <DemoBadge /> : null}
        {d.status === "quoted" ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">Has quotes</span> : null}
      </div>
      <PrivacyNotice />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Distance</dt><dd className="font-medium">{formatDistance(d.distance_km)}</dd></div>
        <div><dt className="text-muted-foreground">Within your service area</dt><dd className="font-medium">{d.within_service_area === null ? "Unknown" : d.within_service_area ? "Yes" : "No"}</dd></div>
        <div><dt className="text-muted-foreground">Monthly units</dt><dd className="font-medium">{d.monthly_units ?? "Not provided"}</dd></div>
        <div><dt className="text-muted-foreground">Budget</dt><dd className="font-medium">{formatInr(d.budget)}</dd></div>
        <div><dt className="text-muted-foreground">Preferred capacity</dt><dd className="font-medium">{formatKw(d.preferred_capacity_kw)}</dd></div>
        <div><dt className="text-muted-foreground">Posted</dt><dd className="font-medium">{formatPosted(d.created_at)}</dd></div>
        <div><dt className="text-muted-foreground">Approximate location</dt><dd className="font-medium">{d.approx_latitude}, {d.approx_longitude}</dd></div>
      </dl>

      <section aria-labelledby="roof-photo-heading" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <h3 id="roof-photo-heading" className="text-base font-semibold">Roof photo</h3>
        {d.roof_photo_status === "available" && d.roof_photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
          <img src={d.roof_photo.url} alt="Roof photo supplied by the household" className="max-h-96 w-full rounded-lg object-contain" />
        ) : d.roof_photo_status === "unavailable" ? (
          <div className="flex items-center gap-3 text-sm">
            <span>Photo unavailable.</span>
            <Button variant="outline" onClick={retry}>Photo unavailable — retry</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No roof photo.</p>
        )}
      </section>

      <RoofAssessmentSummary assessment={d.roof_assessment} />

      {/* Slot for spec 005: quote submission (links to /vendor/requests/[id]/quote). Owned by the 005 agent. */}
      <VendorQuotePanel requestId={d.id} requestStatus={d.status} />
    </div>
  );
}
