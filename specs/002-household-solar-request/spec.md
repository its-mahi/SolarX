# Feature Specification: Household Solar Request

**Feature Branch**: `002-household-solar-request`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Household dashboard and create-request wizard: location map pin → roof photo upload to private storage → monthly units, optional bill, budget, optional preferred capacity → review → publish. Request lifecycle draft → open, AI-consent checkbox (analysis itself is feature 008), owner-only access to requests and photos. Clear extension points so the estimate card (003), roof analysis panel (008) and voice button on the usage step (010) can plug into the wizard and dashboard without rewriting them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and publish a solar request (Priority: P1)

A household (e.g. the demo "Sharma Residence" in Hyderabad) starts a new solar request and is
guided through four steps: pin the home on a map and enter the address and locality; upload a
photo of the terrace and decide whether to allow AI analysis of it; enter monthly electricity
consumption, budget and optionally the latest monthly bill and a preferred system size; review
everything, including exactly what vendors will and will not see, and publish. The request
becomes "open" and visible to vendors (through the vendor discovery feature).

**Why this priority**: The request is the first step of the request → quote → compare → accept
flow that is the product (constitution I). The plan's P0 acceptance condition is "request
persists with location, usage, budget and photo reference".

**Independent Test**: Sign in as the demo household, complete all four steps with a sample roof
photo, publish, and confirm the request shows status "Open" with the entered location, usage,
budget and photo; confirm editing is no longer possible.

**Acceptance Scenarios**:

1. **Given** a signed-in household on the dashboard, **When** they choose "New request",
   **Then** the wizard opens at step 1 "Location" with a map centred on Hyderabad and a
   progress indicator showing four steps.
2. **Given** step 1, **When** they place the pin, enter address and locality and continue,
   **Then** a draft request is saved and step 2 "Roof photo" opens.
3. **Given** step 2, **When** they upload a JPEG, PNG or WebP photo up to 5 MB, **Then** a
   preview is shown and the photo is stored privately against the draft.
4. **Given** step 2, **When** they tick "Allow AI analysis of my roof photo", **Then** the
   consent is recorded with the request; if they leave it unticked, no consent is recorded.
5. **Given** step 3, **When** they enter 250 units per month and a budget of ₹1,50,000 (and
   optionally a bill and a preferred 3 kW) and continue, **Then** the values are saved and the
   review step opens.
6. **Given** a complete draft on the review step, **When** they press "Publish" and confirm in
   the dialog that explains what vendors will see, **Then** the request status becomes "Open",
   they are taken to the request page with a success message, and the request can no longer be
   edited.
7. **Given** a draft missing any of location, monthly units, budget or roof photo, **When** they
   view the review step, **Then** "Publish" is disabled and each missing item is listed with a
   link to the step that fixes it.

---

### User Story 2 - Only I can see and change my request (Priority: P1)

A household's request — including exact address, map pin, consumption, budget and roof photo —
is visible and changeable only by that household. Other households, vendors using household
operations, and anonymous visitors cannot read, change, publish or upload to it. Exact address
and pin are never part of anything this feature shows to anyone other than the owner.

**Why this priority**: Constitution IV requires server-side and data-layer authorization and
forbids exposing exact household location to vendors before acceptance. A privacy failure here
would undermine the whole marketplace.

**Independent Test**: With two households A and B and a vendor V, try every request operation
as B, V and anonymous against A's draft and A's published request, and try to open A's photo
directly; all attempts are refused and nothing is disclosed or changed.

**Acceptance Scenarios**:

1. **Given** household A's request, **When** household B tries to view, edit, publish or upload a
   photo to it, **Then** the response is "not found" and nothing changes.
2. **Given** any request, **When** an anonymous visitor tries any request operation, **Then** they
   are told to sign in and nothing is disclosed.
3. **Given** a vendor, **When** they try to create a request or use the household's edit,
   publish or photo operations, **Then** the attempt is refused.
4. **Given** A's roof photo, **When** anyone other than A requests it without a valid
   short-lived link issued to an authorized viewer, **Then** it is not served; links issued to A
   expire within 10 minutes.
5. **Given** a photo taken on a phone containing embedded GPS location, **When** it is uploaded,
   **Then** the stored photo contains no location or device metadata.
6. **Given** a household editing their own draft, **When** they try to set the status, owner or
   photo reference directly, **Then** the attempt is rejected.

---

### User Story 3 - See my requests and what to do next (Priority: P2)

On the household dashboard the household sees all of their requests with status, key figures
and the single next action for each (continue draft, wait for quotes, compare quotes, view next
steps), plus an always-visible "New request" action. The dashboard also has reserved places
where the indicative estimate, roof observations, incoming quotes and the advisor shortcut
appear once those features exist.

**Why this priority**: The plan's household dashboard (screen 2) keeps the household's next
action visible (constitution UX standard), but the P0 flow can be demonstrated through the
wizard and request page alone.

**Independent Test**: With requests in draft, open and (simulated) quoted status, open the
dashboard and verify each card shows status, locality, units, budget and the correct next
action; with no requests, verify the empty state and its call to action.

**Acceptance Scenarios**:

1. **Given** a household with no requests, **When** they open the dashboard, **Then** they see an
   empty state explaining the first step and a "Create your solar request" action.
2. **Given** a household with requests, **When** they open the dashboard, **Then** requests are
   listed newest first, each showing status, locality, monthly units, budget, preferred
   capacity (if any), created date and its next action.
3. **Given** a draft request, **Then** its next action is "Continue request", opening the wizard at
   the first incomplete step.
4. **Given** an open request, **Then** it reads "Waiting for vendor quotes"; **given** a quoted
   request, "Compare quotes"; **given** an accepted request, "View next steps"; **given** a closed
   request, "View request".
5. **Given** the dashboard is loading or the data cannot be loaded, **Then** a loading state or an
   error state with retry is shown instead of an empty list.

---

### User Story 4 - Resume a draft and manage AI consent (Priority: P3)

A household who stopped half-way returns later and continues the draft exactly where they left
off, changing any earlier answer. They can also change their mind about AI analysis of the roof
photo: while the request is a draft they can give or remove consent, and at any later time they
can withdraw it.

**Why this priority**: Improves real-world usability and privacy control, but the demo flow
completes in one sitting.

**Independent Test**: Complete step 1 and 2, close the browser, sign in again, open the draft
from the dashboard, verify all values and photo are restored, change the address, and finish.
On a published request with consent, withdraw consent and verify it is recorded as withdrawn.

**Acceptance Scenarios**:

1. **Given** a saved draft, **When** the household opens it, **Then** the wizard opens at the first
   incomplete step with all saved values and the photo preview restored.
2. **Given** a draft, **When** they go back to any step and change a value, **Then** the change is
   saved and reflected on the review step.
3. **Given** a draft with a photo, **When** they upload a different photo, **Then** the new photo
   replaces the old one and the old one is no longer stored.
4. **Given** a published request with AI consent, **When** the household withdraws consent,
   **Then** consent is recorded as withdrawn; **when** they try to grant consent after
   publishing, **Then** it is refused with an explanation.

---

### Edge Cases

- Pin placed outside India, in the sea, or coordinates typed out of range → validation error
  "SolarX currently supports locations in India".
- Map tiles fail to load (offline or tile service down) → coordinates can still be entered
  manually or taken from the device location; the step stays usable.
- Device location permission denied → a message explains how to place the pin manually.
- Photo larger than 5 MB, wrong type (e.g. HEIC, PDF, GIF), renamed non-image file, or corrupt
  image → rejected with a specific message; the draft keeps any previous photo.
- Photo upload interrupted by network failure → error with retry; other entered values remain.
- Very large phone photos (e.g. 12 MP) → reduced to a sensible size before upload so the upload
  succeeds within the 5 MB limit.
- Monthly units 0, negative, decimal, or absurdly high; budget below ₹10,000 or above
  ₹50,00,000; preferred capacity below 0.5 kW or above 20 kW → field-level errors.
- Publish pressed twice quickly, or publish attempted from two tabs → only one transition; the
  second attempt is told the request is already published.
- Editing a draft in one tab after it was published in another → refused with "This request has
  been published and can no longer be edited".
- Household session expires mid-wizard → next save prompts sign-in and returns to the same step;
  already-saved values are kept.
- A household has many requests → dashboard still lists them all (no pagination needed for
  MVP volumes) newest first.
- Address or locality containing script-like text → stored and displayed as plain text.

## Requirements *(mandatory)*

### Functional Requirements

**Create-request wizard**

- **FR-001**: Signed-in households MUST be able to start a new solar request from the
  dashboard; the wizard MUST present four ordered steps — Location, Roof photo, Usage & budget,
  Review & publish — with a progress indicator and the ability to go back to earlier steps.
- **FR-002**: The Location step MUST let the household set the home position by placing or
  dragging a pin on a map (default view centred on Hyderabad), with keyboard-accessible
  alternatives: typing latitude/longitude or using the device's current location. It MUST also
  capture the full address (5–300 characters) and the locality/neighbourhood (2–100
  characters). Positions outside India MUST be rejected.
- **FR-003**: The request MUST be saved as a draft when the Location step is first completed,
  and every later step MUST save its values when the household continues, so that progress is
  never lost.
- **FR-004**: The Roof photo step MUST accept exactly one terrace/roof photo per request in JPEG,
  PNG or WebP format up to 5 MB, show a preview, allow replacing it (the replaced photo is
  deleted), and reject other types, oversize files, renamed non-images and corrupt images with
  specific messages.
- **FR-005**: Roof photos MUST be stored privately, never publicly addressable, and viewable only
  through links that expire within 10 minutes and are issued only to authorized viewers.
- **FR-006**: Roof photos MUST have embedded metadata (including GPS location, device and
  timestamp information) removed and be reduced to a sensible maximum dimension before storage.
- **FR-007**: The Roof photo step MUST offer an optional, unticked-by-default consent "Allow
  SolarX to send this roof photo to an AI service to describe visible obstructions", explained
  in plain language. The choice MUST be stored with the request. This feature performs no AI
  processing.
- **FR-008**: While a request is a draft, the household MUST be able to give or remove AI consent;
  after publishing, the household MUST be able to withdraw consent at any time but MUST NOT be
  able to grant it.
- **FR-009**: The Usage & budget step MUST capture: monthly electricity consumption in units
  (kWh), a whole number from 1 to 10,000 (required); latest monthly bill in ₹, a whole number from
  0 to 1,00,000 (optional); budget in ₹, a whole number from 10,000 to 50,00,000 (required); and
  preferred system capacity in kW, 0.5 to 20 with at most one decimal place (optional).
- **FR-010**: The Usage & budget step MUST reserve a place next to the consumption fields for an
  optional voice-entry control (provided later); any value it suggests MUST be shown for the
  household to confirm or edit before it is saved.
- **FR-011**: The Review step MUST show every entered value grouped by step with an "Edit" link
  per group, the roof photo preview, the AI consent choice, the list of items still missing for
  publishing, and a privacy notice stating what vendors will see (approximate location to about
  1 km, locality, consumption, budget, preferred capacity, roof photo) and will not see until
  the household accepts their quote (exact address, map pin, name, phone).
- **FR-012**: Publishing MUST require the map position, address, locality, monthly units, budget
  and a roof photo; if any is missing, publishing MUST be blocked and each missing item listed
  with a link to its step.
- **FR-013**: Publishing MUST require an explicit confirmation; on success the request status
  MUST change from draft to open, the household MUST be taken to the request page with a success
  message, and the request MUST no longer be editable (except AI consent withdrawal per FR-008).
- **FR-014**: Only a draft can be published. Publishing an already-published request, repeated
  or concurrent publish attempts, and edits to a non-draft request MUST be refused with a clear
  "already published / no longer editable" message and MUST NOT change the request.

**Request lifecycle**

- **FR-015**: Request statuses MUST be exactly draft, open, quoted, accepted and closed. This
  feature performs only draft → open. Any transition outside the canonical lifecycle
  (draft → open → quoted → accepted → closed, with acceptance also allowed from open) MUST be
  refused by the server and by the data layer; the household can never set a status directly.

**Dashboard and request page**

- **FR-016**: The household dashboard MUST list all of the household's own requests, newest
  first, each showing status, locality, monthly units, budget, preferred capacity (if any),
  created date and its next action, with a "New request" action always visible.
- **FR-017**: When the household has no requests, the dashboard MUST show an empty state that
  explains the first step and offers "Create your solar request".
- **FR-018**: The next action MUST be derived from status: draft → "Continue request" (to the
  first incomplete step); open → "Waiting for vendor quotes" (to the request page); quoted →
  "Compare quotes"; accepted → "View next steps"; closed → "View request".
- **FR-019**: The request page MUST open drafts in the wizard at the first incomplete step and
  show non-draft requests as a read-only summary with status, location (map with pin, address,
  locality), usage and budget, roof photo, and AI consent state.
- **FR-020**: The dashboard, the review step and the request page MUST reserve clearly bounded
  places for content supplied by later features — the indicative estimate, roof observations,
  incoming quotes summary and advisor shortcut — that render nothing when the feature is absent
  and never break the page if that content fails.

**Access control and privacy**

- **FR-021**: Only signed-in households MUST be able to create requests. Only the owning
  household MUST be able to view, edit, publish or upload a photo for a request through the
  household operations; other users MUST receive "not found" (existence not disclosed),
  anonymous callers "sign in required", and vendors "forbidden" for household-only operations.
- **FR-022**: These rules MUST be enforced both by the server and at the data and file-storage
  layers, so that a direct data or file request by a non-owner returns nothing.
- **FR-023**: Every request input MUST be validated on the server with field-level errors;
  attempts to set status, owner, photo reference or any unknown field through editing MUST be
  rejected.
- **FR-024**: Nothing delivered by this feature to anyone other than the owner MAY contain the
  exact address or exact pin position (vendor-facing views with approximate location are
  delivered by the vendor discovery feature).

**States, accessibility and logging**

- **FR-025**: Every step and page MUST implement loading, empty (where applicable), success and
  error states; uploads MUST show progress; a failed save or upload MUST keep the entered values
  and offer retry.
- **FR-026**: All form fields MUST have visible labels and be keyboard operable; money MUST be
  displayed in rupees with Indian digit grouping (e.g. ₹1,50,000) and consumption in units (kWh).
- **FR-027**: Each request creation and status change MUST be logged with request identifier,
  previous and new status only — never the address, coordinates, photo or contact details.

### Key Entities *(include if feature involves data)*

- **Household Request**: A household's solar requirement. Attributes: owner (household), full
  address, locality, map position (latitude, longitude), monthly consumption (units), monthly
  bill (optional), budget, preferred capacity (optional), roof photo reference, AI consent, status
  (draft/open/quoted/accepted/closed), created and updated times. One household has many
  requests. Later features attach an estimate (0–1), roof assessments (many), quotes (many) and
  an acceptance (0–1).
- **Roof Photo**: One private image per request, stored in the owner's private area with
  metadata removed; replaced rather than versioned.
- **Next Action**: A derived, non-stored value per request telling the household what to do next
  based on its status and completeness.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a roof photo at hand, the demo household completes all four steps and
  publishes in under 3 minutes.
- **SC-002**: 100% of publish attempts on incomplete drafts are blocked, and the message names
  every missing item.
- **SC-003**: In the automated test suite, 0 attempts by another household, a vendor or an
  anonymous user to read or change a request or its photo through household operations or
  directly at the data/file layer succeed.
- **SC-004**: A test photo containing GPS metadata is stored with 0 location or device metadata.
- **SC-005**: After closing the browser at any step and returning, 100% of previously saved
  values and the photo are restored.
- **SC-006**: The dashboard shows the correct next action for all 5 statuses.
- **SC-007**: The wizard and dashboard are fully usable at 360 px width and with the keyboard
  alone (no pointer required to complete a request).

## Assumptions

- **No address search or reverse geocoding**: the household types the address and locality; the
  map only captures the position. This avoids a third-party geocoding dependency for the MVP.
- **India-only**: positions must lie within India's approximate bounding box (latitude 6.5–37.5,
  longitude 68–97.5).
- **Numeric ranges** in FR-002 and FR-009 are product defaults chosen for residential rooftop
  solar; they are not stated in the plan.
- **Photo handling**: one photo per request; the photo is reduced to at most 2048 px on its
  longest side before upload so typical phone photos fit the 5 MB limit; replacement deletes the
  previous file.
- **Multiple requests**: a household may have several requests; drafts cannot be deleted in the
  MVP.
- **AI consent**: default off; can be withdrawn after publishing but not newly granted (the
  request is then locked).
- **"Not found" for others' requests**: other households receive "not found" rather than
  "forbidden" so that request existence is not disclosed.
- **Dependencies**: `001-platform-foundation-auth` (sign-in, roles, app shell, response
  envelope, authorization guard, shared vocabulary, demo household, test helpers).
- **Consumers of this feature's extension points**: `003-solar-financial-engine` (estimate card
  on review step, dashboard and request page), `004-vendor-request-discovery` (vendor branch of
  request listing and detail, vendor photo access with approximate location),
  `006-quote-comparison-scoring` (quotes summary / "Compare quotes" target),
  `007-quote-acceptance` (accepted state, next steps, closing), `008-roof-photo-analysis` (roof
  analysis panel; reads the consent), `010-voice-requirement-entry` (voice control on the usage
  step), `011-ai-solar-advisor` (advisor shortcut).
- **Out of scope**: vendor-facing request views and filters (004), estimate calculation (003),
  AI roof analysis (008), voice parsing (010), quotes, comparison and acceptance (005–007),
  closing requests (007), deleting or duplicating requests, multiple photos, notifications.
