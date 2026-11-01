"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type WithdrawQuoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  onWithdrawn: () => void;
};

export function WithdrawQuoteDialog({ open, onOpenChange, quoteId, onWithdrawn }: WithdrawQuoteDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/withdraw`, { method: "POST" });
      if (res.ok) {
        onOpenChange(false);
        onWithdrawn();
        return;
      }
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Could not withdraw the quote. Please try again.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (pending ? undefined : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw this quote?</DialogTitle>
          <DialogDescription>
            This cannot be undone. You can submit a new quote while the request is open.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={withdraw} disabled={pending}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
