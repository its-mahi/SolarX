"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AcceptQuoteDialog } from "./accept-quote-dialog";
import type { QuoteStatus } from "@/lib/validation/enums";

export type AcceptQuoteButtonProps = {
  quoteId: string;
  quoteStatus: QuoteStatus;
  /** Computed by the integration layer (spec 002 canTransition / 006 view). */
  canAccept: boolean;
  vendorName: string;
  price: number;
  capacityKw: number;
  estimatedNetCost: number | null;
  otherActiveCount: number;
  /** Called after an accept or a conflict so a client-side list can refetch. */
  onChanged?: () => void;
};

const OUTCOME_LABEL: Record<QuoteStatus, string> = {
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export function AcceptQuoteButton({ canAccept, quoteStatus, quoteId, onChanged, ...rest }: AcceptQuoteButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!canAccept) return <Badge variant="outline">{OUTCOME_LABEL[quoteStatus]}</Badge>;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-h-11 w-full sm:w-auto">
        Accept quote
      </Button>
      <AcceptQuoteDialog
        open={open}
        onOpenChange={setOpen}
        quoteId={quoteId}
        {...rest}
        onAccepted={() => {
          toast.success("Quote accepted");
          router.refresh();
          onChanged?.();
        }}
        onConflict={(message) => {
          toast.error(message);
          router.refresh();
          onChanged?.();
        }}
      />
    </>
  );
}
