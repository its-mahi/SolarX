// Request status state machine (data-model.md "State transitions"). Pure; no I/O.
import type { RequestStatus } from "@/lib/validation/enums";

export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  draft: ["open"],
  open: ["quoted", "accepted"],
  quoted: ["accepted"],
  accepted: ["closed"],
  closed: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid request status transition: ${from} -> ${to}`);
  }
}

/** Only drafts are editable. */
export function isEditable(status: RequestStatus): boolean {
  return status === "draft";
}

/** Vendors may quote on open and already-quoted requests. */
export function isQuotable(status: RequestStatus): boolean {
  return status === "open" || status === "quoted";
}
