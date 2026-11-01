import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onBack?: () => void; pending?: boolean; continueLabel?: string; continueDisabled?: boolean };

export function StepActions({ onBack, pending = false, continueLabel = "Continue", continueDisabled = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {onBack ? (
        <Button type="button" variant="outline" size="lg" className="h-11 px-5" onClick={onBack} disabled={pending}>
          Back
        </Button>
      ) : null}
      <Button type="submit" size="lg" className="h-11 px-6" disabled={pending || continueDisabled}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {pending ? "Saving…" : continueLabel}
      </Button>
    </div>
  );
}
