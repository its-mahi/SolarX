// Extension slots hosted by the household wizard, dashboard and request page.
// Each owner edits only their own slot's body (contracts/ui-extension-slots.md). Hosts wrap
// every slot in <SlotBoundary>. All slots initially render nothing.
import { EstimateCard } from "@/components/shared/estimate-card";
import type {
  AdvisorShortcutSlotProps,
  RequestAcceptanceSlotProps,
  RequestEstimateSlotProps,
  RequestQuotesSlotProps,
  RoofAnalysisSlotProps,
  UsageVoiceSlotProps,
} from "./extension-slot-types";
import { AdvisorShortcutCard } from "@/components/advisor/advisor-shortcut-card";
import { AcceptedNextSteps } from "./accepted-next-steps";
import { RoofAnalysisPanel } from "./roof-analysis-panel";
import { QuotesSlotBody } from "./quotes-slot-body";
import { VoiceEntryPanel } from "./voice/voice-entry-panel";

/** Owner: 003 (estimate card). */
export function RequestEstimateSlot({ request, variant }: RequestEstimateSlotProps) {
  return <EstimateCard request={request} variant={variant} />;
}

/** Owner: 008 (roof analysis panel). */
export function RoofAnalysisSlot(props: RoofAnalysisSlotProps) {
  return <RoofAnalysisPanel key={`${props.hasRoofPhoto}-${props.aiConsent}`} {...props} />;
}

/** Owner: 010 (voice requirement entry). */
export function UsageVoiceSlot({ onSuggest, disabled }: UsageVoiceSlotProps) {
  return <VoiceEntryPanel onSuggest={onSuggest} disabled={disabled} />;
}

/** Owner: 006 (quote comparison entry and counts). */
export function RequestQuotesSlot({ request, variant }: RequestQuotesSlotProps) {
  return <QuotesSlotBody request={request} variant={variant} />;
}

/** Owner: 007 (acceptance summary). */
export function RequestAcceptanceSlot({ request }: RequestAcceptanceSlotProps) {
  if (request.status !== "accepted" && request.status !== "closed") return null;
  return <AcceptedNextSteps requestId={request.id} status={request.status} />;
}

/** Owner: 011 (AI advisor shortcut). */
export function AdvisorShortcutSlot({ request }: AdvisorShortcutSlotProps) {
  return <AdvisorShortcutCard request={request} />;
}
