"use client";

import { Loader2 } from "lucide-react";
import { PrivacyNotice } from "@/components/household/privacy-notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; pending: boolean; error: string | null };

export function PublishDialog({ open, onOpenChange, onConfirm, pending, error }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish your request?</DialogTitle>
          <DialogDescription>Once published, vendors can send quotes and you can no longer edit the request.</DialogDescription>
        </DialogHeader>
        <PrivacyNotice />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="lg" className="h-11" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {pending ? "Publishing…" : "Publish request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
