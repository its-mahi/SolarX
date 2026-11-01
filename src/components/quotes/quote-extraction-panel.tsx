"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MAX_QUOTE_FILE_BYTES, MAX_QUOTE_TEXT_CHARS, type QuoteExtractData } from "@/lib/validation/quote-extraction";

type Status = "idle" | "extracting" | "done" | "unavailable" | "error";

const TYPES = ["image/jpeg", "image/png", "application/pdf"];
const TEXTAREA =
  "min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** Vendor-side "Extract from document": pre-fills the quote form; never submits anything. All text is rendered as plain text. */
export function QuoteExtractionPanel({
  requestId,
  onPrefill,
  onClear,
  disabled = false,
}: {
  requestId: string;
  onPrefill: (data: QuoteExtractData) => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<QuoteExtractData | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function run() {
    setMessage("");
    if (mode === "text") {
      if (!text.trim()) return fail("error", "Paste the quotation text first.");
      if (text.trim().length > MAX_QUOTE_TEXT_CHARS) return fail("error", "Text too long (max 20,000 characters).");
    } else {
      if (!file) return fail("error", "Choose a file first.");
      if (file.size > MAX_QUOTE_FILE_BYTES) return fail("error", "File too large (max 5 MB).");
      if (!TYPES.includes(file.type)) return fail("error", "Unsupported file type. Use JPEG, PNG or PDF.");
    }
    setStatus("extracting");
    const form = new FormData();
    form.set("request_id", requestId);
    if (mode === "text") form.set("text", text);
    else if (file) form.set("file", file);
    try {
      const res = await fetch("/api/quotes/extract", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        const data = json.data as QuoteExtractData;
        setResult(data);
        setStatus("done");
        onPrefill(data);
        return;
      }
      if (res.status === 413) return fail("error", mode === "file" ? "File too large (max 5 MB)." : "Text too long (max 20,000 characters).");
      if (res.status === 400) return fail("error", "Unsupported input. Use JPEG, PNG or PDF, or paste text.");
      if (res.status === 409) return fail("error", "You can no longer quote on this request.");
      fail("unavailable", "Extraction unavailable — fill in the form manually");
    } catch {
      fail("unavailable", "Extraction unavailable — fill in the form manually");
    }
  }

  function fail(next: Status, msg: string) {
    setStatus(next);
    setMessage(msg);
    queueMicrotask(() => statusRef.current?.focus());
  }

  function clear() {
    setResult(null);
    setStatus("idle");
    setMessage("");
    onClear?.();
  }

  const missing = result?.missing_fields.length ?? 0;
  const discarded = result?.discarded_fields.length ?? 0;
  const filled = result ? 13 - missing : 0; // discarded fields are also null, so they are part of `missing`
  const busy = status === "extracting";

  return (
    <section aria-labelledby="extract-title" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="extract-title" className="text-lg font-semibold">Extract from document</h2>
      <p className="text-sm text-muted-foreground">
        Paste a quotation or upload JPEG, PNG or PDF up to 5 MB, or up to 20,000 characters. AI pre-fills the form below; you review and submit.
      </p>
      <div role="group" aria-label="Input type" className="flex gap-2">
        <Button type="button" size="sm" variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")} aria-pressed={mode === "text"}>
          Paste text
        </Button>
        <Button type="button" size="sm" variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")} aria-pressed={mode === "file"}>
          Upload file
        </Button>
      </div>
      {mode === "text" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extract-text">Quotation text</Label>
          <textarea id="extract-text" className={TEXTAREA} value={text} onChange={(e) => setText(e.target.value)} disabled={busy || disabled} />
          <p className="text-xs text-muted-foreground">{text.length}/{MAX_QUOTE_TEXT_CHARS} characters</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extract-file">Quotation file</Label>
          <input id="extract-file" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy || disabled} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void run()} disabled={busy || disabled}>
          {busy ? "Extracting..." : status === "unavailable" ? "Retry" : "Extract fields"}
        </Button>
        {result ? (
          <Button type="button" variant="outline" onClick={clear}>
            Clear and enter manually
          </Button>
        ) : null}
      </div>
      <p ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="text-sm outline-none">
        {busy ? "Extracting — this can take up to 30 seconds." : null}
        {message}
        {status === "done" && result
          ? filled === 0
            ? "No quotation details found. Fill in the form manually."
            : `${filled} pre-filled · ${missing - discarded} not found · ${discarded} could not be read`
          : null}
      </p>
      {status === "done" && result ? (
        <div className="flex flex-col gap-1 text-sm">
          {result.document_vendor_name ? <p>Name in document: {result.document_vendor_name} (for your information only)</p> : null}
          <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">{result.notice}</p>
          {result.missing_fields.length ? <p>Not found in your document — please fill in: {result.missing_fields.join(", ")}</p> : null}
          {result.discarded_fields.length ? <p>Value could not be read — please check: {result.discarded_fields.join(", ")}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
