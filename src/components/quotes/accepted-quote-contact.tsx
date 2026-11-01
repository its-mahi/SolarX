"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchHouseholdContact } from "@/lib/acceptance-client";
import type { HouseholdContact } from "@/lib/validation/acceptance";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; contact: HouseholdContact };

/** Vendor-only: loads household contact on demand, only for an accepted quote. Nothing is stored client-side. */
export function AcceptedQuoteContact({ quoteId, status }: { quoteId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  if (status !== "accepted") return null;

  async function load() {
    setState({ kind: "loading" });
    const res = await fetchHouseholdContact<HouseholdContact>(quoteId);
    setState(res.ok ? { kind: "ok", contact: res.data } : { kind: "error", message: res.message });
  }

  function change(next: boolean) {
    setOpen(next);
    if (next) void load();
    else setState({ kind: "idle" }); // drop contact data on close
  }

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => change(true)} aria-haspopup="dialog">
        View household contact
      </Button>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Household contact</DialogTitle>
            <DialogDescription>Shared with you because the household accepted your quote.</DialogDescription>
          </DialogHeader>
          <div aria-live="polite">
            {state.kind === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Loading contact details…
              </p>
            ) : null}
            {state.kind === "error" ? (
              <div role="alert" className="space-y-3 text-sm">
                <p className="text-destructive">{state.message}</p>
                <Button type="button" variant="outline" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            ) : null}
            {state.kind === "ok" ? <ContactDetails c={state.contact} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContactDetails({ c }: { c: HouseholdContact }) {
  const osm = `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Name</dt>
      <dd className="font-medium">{c.name}</dd>
      <dt className="text-muted-foreground">Phone</dt>
      <dd className="font-medium">
        {c.phone ? (
          <a className="underline underline-offset-2" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>
            {c.phone}
          </a>
        ) : (
          "Not provided"
        )}
      </dd>
      <dt className="text-muted-foreground">Address</dt>
      <dd className="break-words">{c.addressText ?? "Not provided"}</dd>
      <dt className="text-muted-foreground">Locality</dt>
      <dd>{c.locality ?? "Not provided"}</dd>
      <dt className="text-muted-foreground">Location</dt>
      <dd>
        {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}{" "}
        <a className="underline underline-offset-2" href={osm} target="_blank" rel="noopener noreferrer">
          Open in OpenStreetMap
        </a>
      </dd>
    </dl>
  );
}
