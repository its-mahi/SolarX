"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { patchRequest } from "./request-wizard/use-request-api";

/** Shown on published requests: consent can be withdrawn, never re-granted (FR-008). */
export function ConsentControl({ requestId, aiConsent }: { requestId: string; aiConsent: boolean }) {
  const [consent, setConsent] = useState(aiConsent);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    const result = await patchRequest(requestId, { ai_consent: false });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setConsent(false);
    setOpen(false);
  }

  if (!consent) {
    return (
      <p className="text-sm text-muted-foreground">
        {aiConsent ? "AI analysis consent withdrawn. " : "AI analysis is off for this request. "}
        Consent can only be given before publishing.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm">You allowed AI analysis of your roof photo.</p>
      <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setOpen(true)}>
        Withdraw AI analysis consent
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw AI analysis consent?</DialogTitle>
            <DialogDescription>Your roof photo will no longer be sent to an AI service. You cannot turn this back on after publishing.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" size="lg" className="h-11" onClick={withdraw} disabled={pending}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Withdraw consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
