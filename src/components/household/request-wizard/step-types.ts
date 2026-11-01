import type { HouseholdRequestDto } from "@/lib/validation/requests";

export type StepProps = {
  request: HouseholdRequestDto | null;
  /** Called after a successful save with the server's DTO; the wizard moves on. */
  onContinue: (dto: HouseholdRequestDto) => void;
  /** Called with a server DTO that should replace the wizard's copy without moving on. */
  onUpdated: (dto: HouseholdRequestDto) => void;
  onBack?: () => void;
  /** Called on a 409: the request was published elsewhere. */
  onConflict: () => void;
};
