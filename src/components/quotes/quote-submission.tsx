"use client";

import Link from "next/link";
import { useState } from "react";
import { QuoteForm, type QuoteFormRequestSummary } from "@/components/quotes/quote-form";
import { QuoteSummary } from "@/components/quotes/quote-summary";
import { QuoteExtractionPanel } from "@/components/quotes/quote-extraction-panel"; // 009
import { Button } from "@/components/ui/button";
import { fieldErrorsFromDetails, type FieldErrors } from "@/lib/forms";
import type { QuoteFields, QuoteFieldsInput, QuoteRecord } from "@/lib/validation/quote";
import type { QuoteExtractData } from "@/lib/validation/quote-extraction"; // 009

/** Client half of the vendor quote page: posts the form and shows the stored quote. */
export function QuoteSubmission({ requestId, request }: { requestId: string; request: QuoteFormRequestSummary }) {
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [saved, setSaved] = useState<QuoteRecord | null>(null);
  // 009: AI pre-fill. The form remounts (key) so it picks up new defaultValues; submission is still manual.
  const [extraction, setExtraction] = useState<{ data: QuoteExtractData; key: number } | null>(null);

  async function submit(values: QuoteFields) {
    setSubmitting(true);
    setServerErrors({});
    setFormError(undefined);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          request_id: requestId,
          ...(extraction ? { source: "ai_extracted", source_document_path: extraction.data.source_document.path } : {}), // 009
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setSaved(json.data.quote as QuoteRecord);
        return;
      }
      if (res.status === 400) {
        setServerErrors(fieldErrorsFromDetails(json?.error?.details));
        setFormError("Some fields need attention.");
      } else if (res.status === 409) {
        const reason = json?.error?.details?.[0]?.reason;
        setFormError(
          reason === "DUPLICATE_ACTIVE_QUOTE"
            ? "You already have an active quote. Withdraw it to submit a new one."
            : "This request is no longer accepting quotes.",
        );
      } else if (res.status === 403) {
        setFormError("Complete your vendor profile before quoting.");
      } else if (res.status === 401) {
        setFormError("Your session expired. Sign in again in another tab, then submit again. Your answers are kept here.");
      } else if (res.status === 404) {
        setFormError("This request is not available for quoting.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <section aria-labelledby="quote-sent" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 id="quote-sent" className="text-lg font-semibold">
          Your active quote
        </h2>
        <p role="status" className="text-sm">
          Quote submitted. The household can now compare it.
        </p>
        <QuoteSummary quote={saved} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/vendor/requests/${requestId}`}>View request</Link>
          </Button>
          <Button asChild>
            <Link href="/vendor/quotes">My quotes</Link>
          </Button>
        </div>
      </section>
    );
  }

  // 009 start: extraction panel above the form
  const p = extraction?.data.prefill;
  const defaults: Partial<QuoteFieldsInput> | undefined = p
    ? {
        price: p.price ?? undefined,
        capacity_kw: p.capacity_kw ?? undefined,
        panel_details: { ...p.panel_details } as QuoteFieldsInput["panel_details"],
        inverter_details: { ...p.inverter_details } as QuoteFieldsInput["inverter_details"],
        warranty_details: { ...p.warranty_details } as QuoteFieldsInput["warranty_details"],
        installation_days: p.installation_days ?? undefined,
        earthing_included: p.earthing_included,
        documentation_included: p.documentation_included,
      }
    : undefined;
  // 009 end
  return (
    <div className="flex flex-col gap-6">
      <QuoteExtractionPanel
        requestId={requestId}
        disabled={submitting}
        onPrefill={(data) => setExtraction({ data, key: Date.now() })}
        onClear={() => setExtraction(null)}
      />
      <QuoteForm
        key={extraction?.key ?? 0}
        request={request}
        defaultValues={defaults}
        origin={extraction ? "ai_extracted" : "manual"}
        onSubmit={submit}
        submitting={submitting}
        serverErrors={serverErrors}
        formError={formError}
      />
    </div>
  );
}
