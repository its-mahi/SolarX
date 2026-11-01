"use client";

// Lets the owning household look at the document an AI-extracted quote came from (plan §13
// defense 7: the source quote stays available for human review). The document is untrusted vendor
// content: text is shown as plain text, never as HTML, and never interpreted.
import { useCallback, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuoteSourceDocumentResponseSchema } from "@/lib/validation/quote-extraction";

type Doc = { url: string; kind: "text" | "image" | "pdf"; label: string; text?: string };
type State = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; doc: Doc } | { kind: "error"; message: string };

const MAX_TEXT_CHARS = 20_000;

async function loadDocument(quoteId: string): Promise<State> {
  try {
    const res = await fetch(`/api/quotes/${quoteId}/source-document`, { cache: "no-store", credentials: "same-origin" });
    if (res.status === 404) return { kind: "error", message: "The source document is no longer available." };
    if (!res.ok) return { kind: "error", message: "We couldn't open the document. Please try again." };
    const parsed = QuoteSourceDocumentResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { kind: "error", message: "We couldn't open the document. Please try again." };
    const { url, kind, label } = parsed.data.data;
    let text: string | undefined;
    if (kind === "text") {
      const body = await fetch(url);
      if (!body.ok) return { kind: "error", message: "We couldn't open the document. Please try again." };
      text = (await body.text()).slice(0, MAX_TEXT_CHARS);
    }
    return { kind: "ready", doc: { url, kind, label, text } };
  } catch {
    return { kind: "error", message: "We couldn't open the document. Please try again." };
  }
}

export function SourceDocumentViewer({ quoteId, open, onOpenChange }: { quoteId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (next) {
        setState({ kind: "loading" });
        void loadDocument(quoteId).then(setState);
      } else {
        setState({ kind: "idle" });
      }
    },
    [onOpenChange, quoteId],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vendor&apos;s source document</DialogTitle>
          <DialogDescription>
            {state.kind === "ready" ? state.doc.label : "Vendor-provided document — not verified"}. It is shown only so you can check the extracted values.
          </DialogDescription>
        </DialogHeader>
        {state.kind === "loading" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Opening the document…
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        {state.kind === "ready" && state.doc.kind === "text" ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted p-3 text-sm">{state.doc.text}</pre>
        ) : null}
        {state.kind === "ready" && state.doc.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would need a remote pattern
          <img src={state.doc.url} alt="Document supplied by the vendor" className="max-h-96 w-full rounded-lg border object-contain" />
        ) : null}
        {state.kind === "ready" && state.doc.kind === "pdf" ? (
          <Button asChild className="w-fit">
            <a href={state.doc.url} target="_blank" rel="noopener noreferrer">
              Open the PDF in a new tab
            </a>
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SourceDocumentButton({ quoteId }: { quoteId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-h-9">
        <FileText aria-hidden /> View source document
      </Button>
      {open ? <SourceDocumentViewer quoteId={quoteId} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
