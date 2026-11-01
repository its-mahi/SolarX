// "What should the household do next" per request status (data-model.md). The UI builds the href.
import type { RequestStatus } from "@/lib/validation/enums";
import type { PublishReadinessInput } from "./publish-readiness";
import { firstIncompleteStep, type WizardStep } from "./wizard-steps";

export type NextAction = {
  kind: "continue" | "wait" | "compare" | "next_steps" | "view";
  label: string;
  step?: WizardStep;
};

export function nextActionFor(request: PublishReadinessInput & { status: RequestStatus }): NextAction {
  switch (request.status) {
    case "draft":
      return { kind: "continue", label: "Continue request", step: firstIncompleteStep(request) };
    case "open":
      return { kind: "wait", label: "Waiting for vendor quotes" };
    case "quoted":
      return { kind: "compare", label: "Compare quotes" };
    case "accepted":
      return { kind: "next_steps", label: "View next steps" };
    case "closed":
      return { kind: "view", label: "View request" };
  }
}
