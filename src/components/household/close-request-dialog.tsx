"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { closeRequest } from "@/lib/acceptance-client";

export type CloseRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
};

export function CloseRequestDialog({ open, onOpenChange, requestId }: CloseRequestDialogProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function change(next: boolean) {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await closeRequest(requestId);
    setPending(false);
    if (res.ok) {
      onOpenChange(false);
      router.refresh();
    } else {
      setError(res.message); // includes the server message on 409
      if (res.status === 409) router.refresh();
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
          <DialogTitle>Close this request?</DialogTitle>
          <DialogDescription>It will become read-only.</DialogDescription>
        </DialogHeader>
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
            {pending ? "Closing…" : error ? "Try again" : "Close request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
