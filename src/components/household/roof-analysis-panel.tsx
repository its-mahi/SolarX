"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RoofAssessmentStateDto } from "@/lib/validation/roof";
import type { RoofAnalysisSlotProps } from "./extension-slot-types";
import { RoofAssessmentView } from "./roof-assessment-view";

type Props = RoofAnalysisSlotProps;
type Phase = "loading" | "ready" | "analyzing";

/** Optional, never blocking: fetches only the two roof-analysis endpoints. */
export function RoofAnalysisPanel({ requestId, hasRoofPhoto, aiConsent, status, variant }: Props) {
  const [state, setState] = useState<RoofAssessmentStateDto | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [failed, setFailed] = useState(false);
  const compact = variant !== "detail";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/roof-assessment`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) setState(json.data as RoofAssessmentStateDto);
    } catch {
      // The panel is optional; leave the previous state.
    }
    setPhase("ready");
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function analyze() {
    setPhase("analyzing");
    setFailed(false);
    try {
      const res = await fetch("/api/roof/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (!res.ok) setFailed(true);
    } catch {
      setFailed(true);
    }
    await load();
  }

  const analyzable = ["draft", "open", "quoted"].includes(status);
  const completed = state?.latest_completed ?? null;
  const unavailable = failed || state?.latest_attempt?.status === "failed";

  let body: React.ReactNode;
  if (phase === "loading") {
    body = <Skeleton className="h-16 w-full" />;
  } else if (!hasRoofPhoto && !completed) {
    body = <p className="text-sm text-muted-foreground">Add a roof photo to get optional AI observations.</p>;
  } else if (!aiConsent && !completed) {
    body = (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Your photo is sent to an external AI service only if you agree.</p>
        <p>
          {variant === "detail"
            ? "Edit consent on this request"
            : "Turn on 'Allow AI analysis of my roof photo' in the photo step"}
        </p>
      </div>
    );
  } else {
    const canAnalyze = analyzable && hasRoofPhoto && aiConsent;
    const stale = completed && !completed.is_current_photo;
    body = (
      <div className="space-y-3">
        <div aria-live="polite" className="text-sm">
          {phase === "analyzing" && <p>Analyzing… this can take up to 30 seconds.</p>}
          {phase !== "analyzing" && unavailable && (
            <p role="status">
              Analysis unavailable — retry. You can continue with your request.
            </p>
          )}
        </div>
        {completed && (
          <div className="space-y-2">
            {unavailable && (
              <p className="text-xs text-muted-foreground">
                Previous analysis from {new Date(completed.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            )}
            {stale && <p className="text-sm font-medium">This analysis describes a previous photo</p>}
            <RoofAssessmentView assessment={completed} compact={compact} />
          </div>
        )}
        {canAnalyze && (
          <Button type="button" variant={completed ? "outline" : "default"} onClick={analyze} disabled={phase === "analyzing"}>
            {unavailable
              ? "Retry"
              : stale
                ? "Analyze current photo"
                : completed
                  ? "Analyze again"
                  : "Analyze roof photo"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Roof photo analysis" data-testid="roof-analysis-panel" data-variant={variant} className="space-y-2 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">Roof photo analysis (optional)</h3>
      {body}
    </section>
  );
}
