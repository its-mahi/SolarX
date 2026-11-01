"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WIZARD_STEPS, type WizardStep } from "@/lib/domain/requests/wizard-steps";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import { LocationStep } from "./location-step";
import { PhotoStep } from "./photo-step";
import { ReviewStep } from "./review-step";
import type { StepProps } from "./step-types";
import { UsageStep } from "./usage-step";
import { STEP_LABELS, WizardProgress } from "./wizard-progress";

type Props = { initialRequest: HouseholdRequestDto | null; initialStep?: WizardStep };

const PUBLISHED_MESSAGE = "This request has been published and can no longer be edited";

export function RequestWizard({ initialRequest, initialStep }: Props) {
  const router = useRouter();
  const [request, setRequest] = useState<HouseholdRequestDto | null>(initialRequest);
  const [step, setStep] = useState<WizardStep>(initialRequest ? (initialStep ?? initialRequest.next_action.step ?? "review") : "location");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Move focus to the step heading after a step change (not on first render).
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = true;
  }, [step]);

  function syncUrl(id: string | undefined, next: WizardStep) {
    if (id) window.history.replaceState(null, "", `/household/requests/${id}?step=${next}`);
  }

  function goTo(next: WizardStep, dto: HouseholdRequestDto | null = request) {
    setStep(next);
    syncUrl(dto?.id, next);
  }

  function onConflict() {
    toast.error(PUBLISHED_MESSAGE);
    if (request) router.replace(`/household/requests/${request.id}`);
  }

  const index = WIZARD_STEPS.indexOf(step);
  const back = index > 0 ? () => goTo(WIZARD_STEPS[index - 1]) : undefined;
  const stepProps: StepProps = {
    request,
    onUpdated: setRequest,
    onBack: back,
    onConflict,
    onContinue: (dto) => {
      setRequest(dto);
      goTo(WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)], dto);
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <WizardProgress current={step} />
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {STEP_LABELS[step]}
      </h2>
      {step === "location" ? <LocationStep key="location" {...stepProps} /> : null}
      {step === "photo" ? <PhotoStep key="photo" {...stepProps} /> : null}
      {step === "usage" ? <UsageStep key="usage" {...stepProps} /> : null}
      {step === "review" && request ? <ReviewStep request={request} onGoTo={(s) => goTo(s)} onBack={() => goTo("usage")} onConflict={onConflict} /> : null}
    </div>
  );
}
