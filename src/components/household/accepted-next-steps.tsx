"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canCloseRequest } from "@/lib/domain/requests/acceptance";
import { formatDate, formatInr } from "@/lib/format";
import { acceptanceSummarySchema, type AcceptanceSummary } from "@/lib/validation/acceptance";
import type { RequestStatus } from "@/lib/validation/enums";
import { CloseRequestDialog } from "./close-request-dialog";

const PORTAL_URL = "https://pmsuryaghar.gov.in/";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; acceptance: NonNullable<AcceptanceSummary> | null };

/**
 * Accepted-request panel (specs/007 contracts/ui-acceptance.md §2). Reads the `acceptance` field of
 * GET /api/requests/:id/quotes (owner household only). Renders nothing for other statuses.
 */
export function AcceptedNextSteps({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [closing, setClosing] = useState(false);
  const active = status === "accepted" || status === "closed";

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/requests/${requestId}/quotes`, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("load");
      const json = (await res.json()) as { data?: { acceptance?: unknown } };
      const parsed = acceptanceSummarySchema.safeParse(json.data?.acceptance ?? null);
      if (!parsed.success) throw new Error("shape");
      setState({ kind: "ready", acceptance: parsed.data });
    } catch {
      setState({ kind: "error" });
    }
  }, [requestId]);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when the request is accepted/closed
    void load();
  }, [active, load, status]);

  if (!active) return null;
  if (state.kind === "loading") return <Skeleton className="h-48 w-full rounded-xl" aria-label="Loading accepted quote" />;
  if (state.kind === "error") return <ErrorState title="Could not load the accepted quote" onRetry={() => void load()} />;
  const a = state.acceptance;
  if (!a) return null;

  return (
    <section aria-labelledby="accepted-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="accepted-heading" tabIndex={-1} className="flex items-center gap-2 text-xl font-semibold">
        <CheckCircle2 aria-hidden className="size-5 text-primary" />
        {status === "closed" ? "Request closed" : "Quote accepted"}
      </h2>
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {a.vendor.companyName}
          {a.vendor.isDemo ? <Badge variant="outline">Demo</Badge> : null}
        </p>
        <p className="text-sm">
          {a.vendor.phone ? (
            <a className="underline" href={`tel:${a.vendor.phone}`}>
              {a.vendor.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">Phone not provided</span>
          )}
        </p>
        <p className="text-sm">
          {formatInr(a.price)} · {a.capacityKw} kW <span className="text-muted-foreground">(vendor-confirmed)</span>
        </p>
        <p className="text-xs text-muted-foreground">Accepted on {formatDate(a.acceptedAt)}</p>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Next steps</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Call the vendor to confirm the quote details and schedule a site survey.</li>
          <li>Confirm the final price, capacity and inclusions in writing after the survey.</li>
          <li>
            Apply for the subsidy on the{" "}
            <a className="inline-flex items-center gap-1 underline" href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
              official PM Surya Ghar portal
              <ExternalLink aria-hidden className="size-3" />
            </a>
            .
          </li>
          <li>Agree the installation date, then have the system installed and inspected.</li>
          <li>Complete net-metering and commissioning, then claim the subsidy on the portal.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Subsidy is decided and paid under the official scheme; SURYAMIT does not guarantee it.
        </p>
      </div>

      {canCloseRequest(status) ? (
        <div>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setClosing(true)} aria-haspopup="dialog">
            Mark as closed
          </Button>
          <CloseRequestDialog open={closing} onOpenChange={setClosing} requestId={requestId} />
        </div>
      ) : null}
    </section>
  );
}
