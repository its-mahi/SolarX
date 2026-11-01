import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "@/lib/domain/requests/wizard-steps";

export const STEP_LABELS: Record<WizardStep, string> = {
  location: "Location",
  photo: "Roof photo",
  usage: "Usage and budget",
  review: "Review",
};

export function WizardProgress({ current }: { current: WizardStep }) {
  const index = WIZARD_STEPS.indexOf(current);
  return (
    <nav aria-label="Request progress">
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        Step {index + 1} of {WIZARD_STEPS.length}: {STEP_LABELS[current]}
      </p>
      <ol className="flex gap-2">
        {WIZARD_STEPS.map((step, i) => (
          <li
            key={step}
            aria-current={step === current ? "step" : undefined}
            className={cn("flex flex-1 flex-col gap-1.5 text-xs", step === current ? "font-semibold text-foreground" : "text-muted-foreground")}
          >
            <span className={cn("h-1.5 rounded-full", i <= index ? "bg-primary" : "bg-border")} aria-hidden />
            <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            <span className="sr-only sm:hidden">{STEP_LABELS[step]}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
