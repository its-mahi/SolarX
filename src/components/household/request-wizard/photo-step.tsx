"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { RoofAnalysisSlot } from "@/components/household/extension-slots";
import { SlotBoundary } from "@/components/shared/slot-boundary";
import { Button } from "@/components/ui/button";
import { StepActions } from "./step-actions";
import type { StepProps } from "./step-types";
import { patchRequest, uploadPhoto } from "./use-request-api";
import { prepareRoofPhoto } from "./resize-image";

export const AI_CONSENT_COPY =
  "Allow SURYAMIT to send this roof photo to an AI service to describe visible obstructions (optional). The photo is only used for this analysis. You can withdraw consent at any time.";

export function PhotoStep({ request, onContinue, onUpdated, onBack, onConflict }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentPending, setConsentPending] = useState(false);
  const [consent, setConsent] = useState(request?.ai_consent ?? false);

  if (!request) return null; // the wizard never renders this step before the draft exists
  const uploading = progress !== null;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !request) return;
    setError(null);
    const prepared = await prepareRoofPhoto(file);
    if (!prepared.ok) return setError(prepared.message);
    setProgress(0);
    const result = await uploadPhoto(request.id, prepared.file, prepared.name, setProgress);
    setProgress(null);
    if (result.ok) return onUpdated(result.data);
    if (result.status === 409) return onConflict();
    setError(result.message);
  }

  async function onConsent(event: ChangeEvent<HTMLInputElement>) {
    if (!request) return;
    const wanted = event.target.checked;
    setConsentError(null);
    setConsent(wanted); // optimistic; reverted if the save fails
    setConsentPending(true);
    const result = await patchRequest(request.id, { ai_consent: wanted });
    setConsentPending(false);
    if (result.ok) return onUpdated(result.data);
    setConsent(!wanted);
    if (result.status === 409) return onConflict();
    setConsentError(result.message);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!uploading) onContinue(request);
      }}
      className="flex flex-col gap-5"
    >
      <p className="text-sm text-muted-foreground">
        Add one clear photo of your roof or terrace (JPEG, PNG or WebP, up to 5 MB). Location details in the photo are removed.
      </p>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          id="roof_photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={onFile}
          aria-describedby={error ? "roof_photo-error" : undefined}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="lg" className="h-11" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Camera aria-hidden />
            {request.has_roof_photo ? "Replace photo" : "Choose or take a photo"}
          </Button>
          <label htmlFor="roof_photo" className="sr-only">
            Roof photo
          </label>
        </div>

        {uploading ? (
          <div role="status" className="flex flex-col gap-1.5">
            <progress value={Math.round((progress ?? 0) * 100)} max={100} aria-label="Upload progress" className="h-2 w-full" />
            <span className="text-sm text-muted-foreground">Uploading… {Math.round((progress ?? 0) * 100)}%</span>
          </div>
        ) : null}

        {error ? (
          <p id="roof_photo-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {request.roof_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={request.roof_photo_url} alt="Your uploaded roof photo" className="max-h-72 w-full rounded-lg border object-contain bg-muted" />
        ) : request.has_roof_photo ? (
          <p className="text-sm text-muted-foreground">Photo saved.</p>
        ) : (
          <p className="text-sm text-muted-foreground">No photo yet. You need one before you can publish.</p>
        )}

        <SlotBoundary name="roof-analysis-photo-step">
          <RoofAnalysisSlot
            requestId={request.id}
            hasRoofPhoto={request.has_roof_photo}
            aiConsent={request.ai_consent}
            status={request.status}
            variant="photo-step"
          />
        </SlotBoundary>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <input
          id="ai_consent"
          type="checkbox"
          checked={consent}
          disabled={consentPending}
          onChange={onConsent}
          className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
          aria-describedby={consentError ? "ai_consent-error" : undefined}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="ai_consent" className="text-sm">
            {AI_CONSENT_COPY}
          </label>
          {consentError ? (
            <p id="ai_consent-error" role="alert" className="text-sm text-destructive">
              {consentError}
            </p>
          ) : null}
        </div>
      </div>

      <StepActions onBack={onBack} continueDisabled={uploading} />
    </form>
  );
}
