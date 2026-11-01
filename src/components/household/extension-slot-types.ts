// Prop contracts for household extension slots (specs/002-household-solar-request/contracts/ui-extension-slots.md).
// Slot owners must not change these types.
import type { RequestStatus } from "@/lib/validation/enums";
import type { HouseholdRequestDto, UsageFields } from "@/lib/validation/requests";

export type SlotVariant = "review" | "detail" | "card" | "photo-step";

export type RequestEstimateSlotProps = { request: HouseholdRequestDto; variant: "review" | "detail" | "card" };

export type RoofAnalysisSlotProps = {
  requestId: string;
  hasRoofPhoto: boolean;
  aiConsent: boolean;
  status: RequestStatus;
  variant: "photo-step" | "review" | "detail";
};

export type UsageVoiceSlotProps = { onSuggest: (values: Partial<UsageFields>) => void; disabled: boolean };

export type RequestQuotesSlotProps = { request: HouseholdRequestDto; variant: "detail" | "card" };

export type RequestAcceptanceSlotProps = { request: HouseholdRequestDto };

export type AdvisorShortcutSlotProps = { request: HouseholdRequestDto; variant: "detail" | "card" };
