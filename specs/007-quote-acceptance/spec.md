# Feature Specification: Quote Acceptance

**Feature Branch**: `007-quote-acceptance`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Quote acceptance (P0): an explicit confirmation dialog; accepting a quote atomically sets the quote to accepted, every other submitted quote on the request to rejected, the request to accepted, and records exactly one acceptance (unique per quote and per request); a second or concurrent attempt returns a conflict; the household sees an accepted / next-steps state; vendors see the outcome of their quotes and only the accepted vendor sees the household's contact details; the household can manually close an accepted request. Mandatory tests: double-accept race, accepting a withdrawn or rejected quote, a non-owner attempt, and status cascade correctness."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accept one quote with explicit confirmation (Priority: P1)

From the comparison screen, the household chooses "Accept quote" on one quote. A confirmation dialog summarises what will happen: the vendor's name, price, capacity and estimated net cost, and that all other active quotes on this request will be declined and the choice cannot be undone in SURYAMIT. Only after the household confirms does the system accept the quote. In one indivisible step the chosen quote becomes accepted, every other submitted quote on the request becomes rejected, the request becomes accepted, and one acceptance record is stored. Any repeated, duplicate or simultaneous attempt is refused with a clear "already accepted" message and changes nothing.

**Why this priority**: "Household owner can accept one quote; duplicate acceptance is prevented" is a P0 acceptance condition and the final step of the judged request → quote → compare → accept flow.

**Independent Test**: With the demo request and three submitted quotes, accept SunRise Energy after confirming; verify SunRise is accepted, GreenVolt and SolarTech are rejected, the request is accepted and one acceptance record exists. Then send two simultaneous accept attempts on a fresh request and verify exactly one succeeds and the other is refused as a conflict.

**Acceptance Scenarios**:

1. **Given** the owning household views a submitted quote on its open or quoted request, **When** it presses "Accept quote", **Then** a confirmation dialog shows the vendor name, price, capacity, estimated net cost, the number of other quotes that will be declined and that the action cannot be undone, with "Cancel" as the default focus.
2. **Given** the confirmation dialog is open, **When** the household presses "Cancel" or Escape, **Then** nothing changes.
3. **Given** the dialog is open, **When** the household confirms, **Then** the chosen quote is accepted, every other submitted quote on the request is rejected, withdrawn quotes stay withdrawn, the request is accepted, one acceptance record (quote, request, household, time) exists, and the screen shows the accepted state.
4. **Given** a request that already has an accepted quote, **When** anyone tries to accept any quote on it again, **Then** the attempt is refused as a conflict ("This request already has an accepted quote") and nothing changes.
5. **Given** two accept attempts for the same request arrive at the same time (same or different quotes), **When** both are processed, **Then** exactly one succeeds, the other is refused as a conflict, and exactly one quote is accepted.
6. **Given** a quote that has been withdrawn or rejected, **When** the household tries to accept it, **Then** the attempt is refused as a conflict and nothing changes.
7. **Given** a vendor, another household or a signed-out visitor, **When** they try to accept a quote on this request, **Then** the vendor is refused as not permitted, the other household receives "not found", the visitor is asked to sign in, and nothing changes.
8. **Given** the household double-clicks the confirm button, **When** the requests are sent, **Then** the button is disabled after the first press and at most one acceptance results.

---

### User Story 2 - See the accepted request and next steps (Priority: P1)

After acceptance, the household's request page and dashboard show that the request is accepted, which vendor was chosen (company name, accepted price and capacity, acceptance date), how to reach the vendor (company name and the vendor's phone), and a short list of next steps: the vendor will contact the household to arrange a site survey; confirm the final design and price after the survey; apply on the official PM Surya Ghar portal; installation, net-metering and inspection; subsidy is decided and paid by the authorities (not guaranteed). The comparison screen becomes read-only with each quote's final status.

**Why this priority**: "See the request move to an accepted/next-steps state" is the last step of the household journey; the household's next action must always be visible.

**Independent Test**: After accepting SunRise, open the request page and dashboard and verify the accepted vendor, price, date, vendor phone and next steps are shown, the comparison shows statuses with no accept buttons, and the next-steps text contains no promise of subsidy.

**Acceptance Scenarios**:

1. **Given** an accepted request, **When** the household opens its request page, **Then** it sees the accepted vendor's company name, phone, accepted price and capacity, acceptance date and the next-steps list with a link to the official portal.
2. **Given** an accepted request, **When** the household opens its dashboard, **Then** the request card shows "Accepted" with the chosen vendor and a "View next steps" action.
3. **Given** an accepted request, **When** the household opens the comparison screen, **Then** every quote shows its final status (accepted / rejected / withdrawn) and no accept action is offered.
4. **Given** the next-steps list, **When** the household reads it, **Then** subsidy is described as decided by the official scheme and not guaranteed.

---

### User Story 3 - Vendors see the outcome; only the accepted vendor sees contact details (Priority: P2)

Each vendor sees the outcome of its quote in its quote history: "Accepted" or "Not selected — the household accepted another quote". Only the vendor whose quote was accepted can open the household's contact details — name, phone, full address and exact map location — so it can arrange the site survey. Vendors whose quotes were rejected or withdrawn, and all other users, never see these details.

**Why this priority**: Required by the privacy decision that contact details are revealed only after acceptance (D-01), and needed for the real-world handover, but the household-side flow already completes the demo.

**Independent Test**: After the household accepts SunRise, sign in as SunRise and open its contact details successfully; sign in as GreenVolt and verify its quote shows "Not selected" and any request for contact details is refused; before acceptance, verify SunRise is also refused.

**Acceptance Scenarios**:

1. **Given** SunRise's quote was accepted, **When** SunRise opens its quote history, **Then** that quote shows "Accepted" and a "View household contact" action revealing name, phone, full address and exact location.
2. **Given** GreenVolt's quote was rejected, **When** GreenVolt opens its quote history, **Then** the quote shows "Not selected — the household accepted another quote" and no contact action; a direct request for contact details is refused.
3. **Given** a quote that is still submitted, **When** its vendor requests contact details, **Then** the request is refused with "Contact details are shared only after the household accepts your quote".
4. **Given** any household, **When** it requests vendor-side contact details, **Then** it is refused as not permitted.
5. **Given** a vendor, **When** it tries to accept a quote, **Then** it is refused; only households accept.

---

### User Story 4 - Close an accepted request (Priority: P3)

When the installation work is arranged or the household no longer needs the request, the household can mark the accepted request as closed after a confirmation. A closed request is read-only and remains visible with its accepted quote and history.

**Why this priority**: Completes the status machine (accepted → closed, D-10) but is not needed for the core demo.

**Independent Test**: Close the accepted demo request and verify it shows "Closed", stays viewable with its accepted vendor, offers no further actions, and that closing a request that is not accepted is refused.

**Acceptance Scenarios**:

1. **Given** an accepted request, **When** the owning household chooses "Mark as closed" and confirms, **Then** the request becomes closed and is shown read-only with its accepted vendor.
2. **Given** a request that is open or quoted, **When** the household tries to close it, **Then** it is refused as a conflict and nothing changes.
3. **Given** a closed request, **When** the household tries to close it again, **Then** it is refused as a conflict.
4. **Given** another household or a vendor, **When** they try to close the request, **Then** the other household receives "not found" and the vendor is refused as not permitted.

---

### Edge Cases

- Two different quotes on the same request accepted simultaneously: exactly one wins; the other gets a conflict.
- The same quote accepted twice simultaneously (double click, two tabs): one success, one conflict.
- A vendor withdraws its quote at the same moment the household accepts it: whichever completes first wins; the other is refused (accept → conflict, or withdraw → conflict), never both.
- A new quote is submitted at the same moment the request is accepted: either the quote is stored before acceptance (and then rejected by the cascade) or it is refused because the request is no longer quotable; it is never left submitted on an accepted request.
- Accepting a quote that belongs to a different request than the one shown: impossible to mismatch, because the quote determines its request.
- Request in draft or closed: acceptance refused.
- Accepted quote's vendor later tries to withdraw: refused (only submitted quotes can be withdrawn — feature 005).
- Network failure after confirming: the household sees an error with retry; retrying after a success returns the "already accepted" conflict and the screen refreshes to the accepted state.
- The accepted vendor's phone is missing from its profile: the next-steps panel shows the company name and "Phone not provided".
- Household address text is empty but coordinates exist: the accepted vendor sees coordinates and locality.
- Undoing an acceptance: not offered in the MVP; the dialog says so.

## Requirements *(mandatory)*

### Functional Requirements

**Accept action and confirmation**

- **FR-001**: The system MUST offer "Accept quote" only to the household that owns the request, only on quotes in submitted status, and only while the request is open or quoted.
- **FR-002**: Acceptance MUST require an explicit confirmation dialog showing the vendor name, price, capacity, estimated net cost, the number of other active quotes that will be declined, and that the action cannot be undone; "Cancel" MUST be the default focus and Escape MUST cancel.
- **FR-003**: The acceptance request MUST carry an explicit confirmation flag; a request without it MUST be rejected as invalid.

**Business rules (overview §9.3)**

- **FR-004**: Only the owning household MAY accept; a vendor MUST be refused as not permitted; another household MUST receive "not found"; an unauthenticated caller MUST be asked to sign in.
- **FR-005**: Acceptance MUST be refused as a conflict when the request is not open or quoted.
- **FR-006**: Acceptance MUST be refused as a conflict when the quote is not in submitted status (withdrawn, rejected or already accepted).
- **FR-007**: A successful acceptance MUST, as one indivisible operation, set the chosen quote to accepted, set every other submitted quote on the same request to rejected, leave withdrawn quotes unchanged, set the request to accepted, and store one acceptance record with the quote, request, household and acceptance time. Either all of these changes happen or none do.
- **FR-008**: The data store MUST guarantee at most one acceptance per request and at most one acceptance per quote, independent of application checks.
- **FR-009**: A second, duplicate or concurrent acceptance attempt for a request that already has (or is concurrently getting) an acceptance MUST be refused as a conflict with the message "This request already has an accepted quote" and MUST leave no partial change.
- **FR-010**: Acceptance checks MUST use the current state at the moment of the change, so a quote withdrawn or a request accepted an instant earlier is detected.
- **FR-011**: A successful response MUST return the acceptance record, the accepted quote's and request's new statuses and the identifiers of the rejected quotes.

**Household after acceptance**

- **FR-012**: The request page MUST show, for an accepted or closed request: accepted vendor company name and phone (or "Phone not provided"), accepted price and capacity, acceptance date and the next-steps list.
- **FR-013**: The next-steps list MUST contain: vendor contacts the household for a site survey; confirm the final design and price after the survey; apply on the official PM Surya Ghar portal (with a link to https://pmsuryaghar.gov.in/); installation, net metering and inspection; subsidy decided and paid under the official scheme, not guaranteed by SURYAMIT.
- **FR-014**: The dashboard request card for an accepted request MUST show "Accepted", the chosen vendor and a "View next steps" action.
- **FR-015**: After acceptance the comparison screen MUST be read-only, showing each quote's final status and offering no accept action.
- **FR-016**: The household MUST see the vendor's phone only for the vendor whose quote it accepted.

**Vendor side and contact reveal (D-01)**

- **FR-017**: Each vendor's quote history MUST show accepted quotes as "Accepted" and rejected quotes as "Not selected — the household accepted another quote".
- **FR-018**: Only the vendor whose quote was accepted MAY obtain the household's name, phone, full address and exact location for that request; the reveal MUST be enforced by the server and by the data store.
- **FR-019**: Vendors whose quotes are submitted, rejected or withdrawn, other vendors, households and anonymous users MUST be refused contact details; a vendor with a submitted quote MUST see the message "Contact details are shared only after the household accepts your quote".
- **FR-020**: Vendors MUST NOT be able to accept quotes.

**Closing (D-10)**

- **FR-021**: The owning household MAY close an accepted request after a confirmation; the request becomes closed and read-only and remains viewable with its accepted quote.
- **FR-022**: Closing MUST be refused as a conflict for any request not in accepted status, and refused for non-owners (other household "not found", vendor "not permitted").

**Cross-cutting**

- **FR-023**: Every status change made by this feature (quote accepted, quotes rejected, request accepted, request closed) MUST be logged with identifiers and statuses only, never names, phone numbers, addresses or coordinates.
- **FR-024**: Errors MUST use the shared error format with human-readable messages and MUST NOT expose stack traces, database messages or internal details.
- **FR-025**: The accept and close actions MUST show a pending state that prevents repeat submission, a success state, an error state with retry, and on conflict MUST refresh to show the current state.
- **FR-026**: Acceptance cannot be undone or changed in the MVP; the confirmation dialog MUST state this.

### Key Entities *(include if feature involves data)*

- **Quote acceptance**: The single record that a household accepted a specific quote on its request: quote, request, household, acceptance time. Unique per request and per quote.
- **Quote** (owned by feature 005): its status moves submitted → accepted for the chosen quote and submitted → rejected for the others.
- **Household request** (owned by feature 002): its status moves open/quoted → accepted on acceptance, and accepted → closed when the household closes it.
- **Household contact**: name, phone, full address and exact location of the household — disclosed only to the accepted vendor.
- **Vendor contact**: company name and phone of the accepted vendor — disclosed only to the household that accepted it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 50 runs of two simultaneous acceptance attempts on the same request, every run ends with exactly one success, one conflict, exactly one accepted quote and exactly one acceptance record.
- **SC-002**: After every successful acceptance in tests, 100% of the other submitted quotes are rejected, 100% of withdrawn quotes remain withdrawn and the request is accepted.
- **SC-003**: 0 successful acceptances of withdrawn or rejected quotes, and 0 successful acceptances or closures by non-owners, across the authorization test set.
- **SC-004**: 0 disclosures of household name, phone, address or exact location to any vendor other than the accepted vendor in tests.
- **SC-005**: A household can accept a quote from the comparison screen in at most 2 actions (accept, confirm) and sees the accepted next-steps state within 2 seconds.
- **SC-006**: The full demo flow — create request, vendor quotes, compare, accept — completes end-to-end in one automated run without manual intervention.

## Assumptions

- Conflicts use the shared "conflict" error; non-owner households get "not found" (so the existence of another household's request is not revealed) and vendors get "not permitted"; the same convention is used by features 003 and 006.
- Acceptance is final in the MVP: no undo, no re-opening, and vendors cannot decline an accepted quote. Disputes are out of scope.
- The vendor's phone shown to the household comes from the vendor's account profile; the household's contact shown to the accepted vendor comes from the household's profile (name, phone) and request (address text, coordinates, locality).
- Closing is manual and available only from accepted status (D-10); there is no automatic closing.
- Status changes are applied by privileged data-store operations that re-check ownership and status under a lock; feature 002's status guard allows them.
- Contact details are fetched on demand and never included in vendor discovery, quote lists or logs.
- **Dependencies**: `001-platform-foundation-auth` (sign-in, roles, profiles with name and phone, shared error format, authorization helper, logging, test tooling); `002-household-solar-request` (household requests, status rules, request page and dashboard extension points for the acceptance panel); `005-vendor-quote-submission` (quotes, statuses, withdrawal rules, vendor quote history); `006-quote-comparison-scoring` (comparison screen and its per-quote action area, quote list used for the accepted summary); `003-solar-financial-engine` (estimated net cost in the confirmation dialog). 007 completes the P0 flow and owns its end-to-end test.
- **Out of scope**: undoing or changing an acceptance; vendor counter-offers; payments, deposits or contracts; scheduling the site survey in-app; notifications by e-mail/SMS; government application submission; automatic closure.
