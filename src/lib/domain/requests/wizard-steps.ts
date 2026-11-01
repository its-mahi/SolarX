// Wizard step order and field-to-step mapping (data-model.md). Pure.
import { getMissingPublishFields, type PublishField, type PublishReadinessInput } from "./publish-readiness";

export const WIZARD_STEPS = ["location", "photo", "usage", "review"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === "string" && (WIZARD_STEPS as readonly string[]).includes(value);
}

export function stepForField(field: PublishField): WizardStep {
  switch (field) {
    case "location":
    case "address_text":
    case "locality":
      return "location";
    case "roof_photo":
      return "photo";
    case "monthly_units":
    case "budget":
      return "usage";
  }
}

export function firstIncompleteStep(request: PublishReadinessInput): WizardStep {
  const missing = getMissingPublishFields(request);
  for (const step of WIZARD_STEPS) {
    if (missing.some((field) => stepForField(field) === step)) return step;
  }
  return "review";
}
