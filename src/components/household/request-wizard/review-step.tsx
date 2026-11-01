"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RequestEstimateSlot, RoofAnalysisSlot } from "@/components/household/extension-slots";
import { PrivacyNotice } from "@/components/household/privacy-notice";
import { SlotBoundary } from "@/components/shared/slot-boundary";
import { Button } from "@/components/ui/button";
import { stepForField, type WizardStep } from "@/lib/domain/requests/wizard-steps";
import type { PublishField } from "@/lib/domain/requests/publish-readiness";
import { formatInr, formatKw, formatUnits } from "@/lib/format";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import { PublishDialog } from "./publish-dialog";
import { STEP_LABELS } from "./wizard-progress";
import { publishRequest } from "./use-request-api";

const MISSING_LABELS: Record<PublishField, string> = {
  location: "Map pin",
  address_text: "Address",
  locality: "Locality",
  monthly_units: "Monthly units",
  budget: "Budget",
  roof_photo: "Roof photo",
};

type Props = { request: HouseholdRequestDto; onGoTo: (step: WizardStep) => void; onBack: () => void; onConflict: () => void };

function Group({ title, step, onGoTo, children }: { title: string; step: WizardStep; onGoTo: (s: WizardStep) => void; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => onGoTo(step)} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value ? value : "Not added yet"}</dd>
    </>
  );
}

export function ReviewStep({ request, onGoTo, onBack, onConflict }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = request.missing_publish_fields;

  async function publish() {
    setPending(true);
    setError(null);
    const result = await publishRequest(request.id);
    if (result.ok) {
      toast.success("Your request is live. Vendors can now send quotes.");
      router.replace(`/household/requests/${request.id}`);
      return;
    }
    setPending(false);
    if (result.status === 409) return onConflict();
    setError(result.message);
  }

  return (
    <div className="flex flex-col gap-5">
      <Group title="Location" step="location" onGoTo={onGoTo}>
        <Row label="Pin" value={request.latitude !== null && request.longitude !== null ? `${request.latitude.toFixed(6)}, ${request.longitude.toFixed(6)}` : null} />
        <Row label="Address" value={request.address_text} />
        <Row label="Locality" value={request.locality} />
      </Group>

      <Group title="Roof photo" step="photo" onGoTo={onGoTo}>
        <Row label="Photo" value={request.has_roof_photo ? "Added" : null} />
        <Row label="AI analysis" value={request.ai_consent ? "You allowed AI analysis" : "Not allowed"} />
      </Group>
      {request.roof_photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
        <img src={request.roof_photo_url} alt="Your roof photo" className="max-h-56 w-full rounded-lg border bg-muted object-contain" />
      ) : null}

      <Group title="Usage and budget" step="usage" onGoTo={onGoTo}>
        <Row label="Monthly use" value={request.monthly_units === null ? null : formatUnits(request.monthly_units)} />
        <Row label="Monthly bill" value={request.monthly_bill === null ? "Not provided" : formatInr(request.monthly_bill)} />
        <Row label="Budget" value={request.budget === null ? null : formatInr(request.budget)} />
        <Row label="Preferred capacity" value={request.preferred_capacity_kw === null ? "Not provided" : formatKw(request.preferred_capacity_kw)} />
      </Group>

      <SlotBoundary name="estimate-review">
        <RequestEstimateSlot request={request} variant="review" />
      </SlotBoundary>
      <SlotBoundary name="roof-analysis-review">
        <RoofAnalysisSlot requestId={request.id} hasRoofPhoto={request.has_roof_photo} aiConsent={request.ai_consent} status={request.status} variant="review" />
      </SlotBoundary>

      {missing.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Complete these items before publishing:</p>
          <ul className="mt-2 list-disc pl-5">
            {missing.map((field) => (
              <li key={field}>
                {MISSING_LABELS[field]} —{" "}
                <button type="button" className="underline underline-offset-2" onClick={() => onGoTo(stepForField(field))}>
                  go to {STEP_LABELS[stepForField(field)]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PrivacyNotice />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="lg" className="h-11 px-5" onClick={onBack}>
          Back
        </Button>
        <Button type="button" size="lg" className="h-11 px-6" disabled={missing.length > 0} onClick={() => setOpen(true)}>
          Publish
        </Button>
      </div>
      <PublishDialog open={open} onOpenChange={setOpen} onConfirm={publish} pending={pending} error={error} />
    </div>
  );
}
