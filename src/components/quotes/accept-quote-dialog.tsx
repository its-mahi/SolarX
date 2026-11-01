"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstimateBadge } from "@/components/shared/estimate-badge";
import { acceptQuote } from "@/lib/acceptance-client";

export type AcceptQuoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  vendorName: string;
  price: number;
  capacityKw: number;
  /** Platform estimate of the household's net cost; null when unavailable. */
  estimatedNetCost: number | null;
  /** Other submitted quotes that will be declined. */
  otherActiveCount: number;
  /** Called after the server accepted the quote (caller refreshes the view). */
  onAccepted: () => void;
  /** Called on a 409 with the server message (caller toasts and refreshes). */
  onConflict?: (message: string) => void;
};

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function AcceptQuoteDialog(props: AcceptQuoteDialogProps) {
  const { open, onOpenChange, quoteId, vendorName, price, capacityKw, estimatedNetCost, otherActiveCount } = props;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function change(next: boolean) {
    if (pending) return; // not dismissible while pending
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await acceptQuote(quoteId);
    setPending(false);
    if (res.ok) {
      onOpenChange(false);
      props.onAccepted();
    } else if (res.status === 409) {
      onOpenChange(false);
      props.onConflict?.(res.message);
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        showCloseButton={!pending}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
        onInteractOutside={(e) => pending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Accept {vendorName}&apos;s quote?</DialogTitle>
          <DialogDescription>Please check the details before you confirm.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Vendor</dt>
          <dd className="font-medium">{vendorName}</dd>
          <dt className="text-muted-foreground">Price</dt>
          <dd className="flex flex-wrap items-center gap-2 font-medium">
            {inr(price)} <EstimateBadge kind="vendor-confirmed" />
          </dd>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className="font-medium">{capacityKw} kW</dd>
          <dt className="text-muted-foreground">Est. net cost</dt>
          <dd className="flex flex-wrap items-center gap-2 font-medium">
            {estimatedNetCost === null ? "Not available" : inr(estimatedNetCost)} <EstimateBadge kind="estimate" />
          </dd>
        </dl>
        <p className="text-sm">
          {otherActiveCount === 0
            ? "There are no other active quotes."
            : `The other ${otherActiveCount} active quote${otherActiveCount === 1 ? "" : "s"} will be declined.`}{" "}
          This cannot be undone in SURYAMIT.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button ref={cancelRef} type="button" variant="outline" disabled={pending} onClick={() => change(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={pending} aria-busy={pending}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {pending ? "Accepting…" : error ? "Try again" : "Accept quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
