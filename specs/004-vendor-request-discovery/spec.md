# Feature Specification: Vendor Request Discovery

**Feature Branch**: `004-vendor-request-discovery`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Vendor dashboard (plan §7 screen 5): open (`open` and `quoted`) household solar requests as a list (P0) and as a map (P1) that also shows the vendor's own service area and radius; filters by location/distance, capacity and budget; a request detail page showing permitted details only (approximate location rounded to 2 decimals, locality, monthly units, budget, preferred capacity, the roof photo via a short-lived link, and the latest roof-assessment summary if one exists). Never show exact address, household name or phone before acceptance."

## User Scenarios & Testing *(mandatory)*

> Product priority mapping: User Stories 1–3 are product **P0** (the vendor must be able to find and
> inspect a request in order to quote). User Story 4 (map and service area) is product **P1**.

### User Story 1 - Browse open requests as a list (Priority: P1)

A signed-in vendor opens the vendor dashboard and sees every household solar request that is
currently accepting quotes (status `open` or `quoted`) as a list of cards. Each card shows only
privacy-safe information: locality, approximate distance from the vendor's base location, monthly
electricity units, budget, preferred capacity (if stated), whether the request already has quotes,
and when it was posted. The vendor never sees the household's name, phone, exact address or exact
coordinates.

**Why this priority**: "Vendor can view open requests" is the P0 acceptance condition for this
feature and the second step of the core request → quote → compare → accept flow. Without it no
quote can be submitted.

**Independent Test**: Seed one `open`, one `quoted`, one `draft`, one `accepted` and one `closed`
request; sign in as a demo vendor; confirm exactly the `open` and `quoted` requests are listed and
that no card or response field contains a name, phone, address or exact coordinate.

**Acceptance Scenarios**:

1. **Given** two requests in `open` and `quoted` status, **When** a vendor opens the dashboard,
   **Then** both appear in the list with locality, approximate distance, monthly units, budget and
   preferred capacity.
2. **Given** requests in `draft`, `accepted` and `closed` status, **When** a vendor opens the
   dashboard, **Then** none of them appear.
3. **Given** a listed request, **When** the vendor inspects the card or the underlying data
   returned to the browser, **Then** no household name, phone, address text or coordinate with more
   than 2 decimal places is present.
4. **Given** no requests are currently open, **When** the vendor opens the dashboard, **Then** an
   empty state explains that there are no open requests right now and suggests widening filters
   or checking back later.
5. **Given** the request list fails to load, **When** the vendor opens the dashboard, **Then** an
   error state with a retry action is shown and no partial or stale private data is displayed.
6. **Given** a signed-in household (not a vendor), **When** it requests the vendor list,
   **Then** it receives only its own requests (household behaviour) and never the vendor view.

---

### User Story 2 - Review a request's permitted details (Priority: P2)

From the list, the vendor opens a request detail page that shows the permitted details needed to
prepare a quote: locality, approximate location, monthly units, budget, preferred capacity, the
household's roof photo (viewable through a link that expires within 10 minutes), and, if one
exists, a summary of the latest completed roof assessment (visible observations, potential
obstructions, limitations, and whether a site survey is recommended). The page clearly says that
the exact address and contact details are shared only if the household accepts the vendor's quote.

**Why this priority**: Vendors need enough detail to price a system without a site visit (D-01).
This is required before quoting, but the list alone already proves discovery works.

**Independent Test**: As a demo vendor, open the detail page of an `open` request with a roof photo
and a completed roof assessment; confirm the photo loads, the link stops working after expiry, the
assessment summary is visible with its limitations, and no private household data is present.
Then try the detail address of a `draft` request and confirm "not found".

**Acceptance Scenarios**:

1. **Given** an `open` request with a roof photo, **When** the vendor opens its detail page,
   **Then** locality, approximate location, monthly units, budget, preferred capacity and the roof
   photo are shown.
2. **Given** the roof-photo link was issued more than 10 minutes ago, **When** it is reused,
   **Then** the photo can no longer be retrieved and reloading the page issues a fresh link.
3. **Given** the request has two completed roof assessments, **When** the vendor opens the detail
   page, **Then** only the most recent one is summarised, with its limitations and the site-survey
   reminder.
4. **Given** the request has no roof assessment (or analysis failed or was never consented to),
   **When** the vendor opens the detail page, **Then** the page shows "No roof assessment
   available" and everything else still works.
5. **Given** a request that is `draft`, `accepted`, `closed` or does not exist, **When** a vendor
   opens its detail address directly, **Then** the vendor sees a "not found" state that does not
   reveal whether the request exists.
6. **Given** the roof photo cannot be retrieved, **When** the detail page loads, **Then** the
   rest of the details are shown with "Photo unavailable — retry".

---

### User Story 3 - Filter requests by distance, capacity and budget (Priority: P3)

The vendor narrows the list with filters: maximum distance from the vendor's base location
(defaulting to the vendor's own service radius), locality text, preferred capacity range and
budget range. Filters can be cleared in one action, and the active filters are visible.

**Why this priority**: The plan's vendor journey (§5.2 step 4) requires filtering by location,
capacity and budget so vendors can focus on serviceable, suitable jobs. The list is still usable
without filters, so this follows Stories 1 and 2.

**Independent Test**: With seeded requests at known approximate distances, capacities and budgets,
apply each filter alone and in combination and confirm the result set exactly matches the
expected subset.

**Acceptance Scenarios**:

1. **Given** a vendor with a base location and a 25 km service radius, **When** the dashboard
   first loads, **Then** the distance filter defaults to 25 km and only requests within 25 km
   (measured to their approximate location) are shown, with a visible option to show all.
2. **Given** a capacity filter of 3–5 kW, **When** applied, **Then** only requests whose
   preferred capacity is between 3 and 5 kW inclusive are listed; requests without a preferred
   capacity are excluded while a capacity filter is active.
3. **Given** a budget filter of ₹1,00,000–₹2,00,000, **When** applied, **Then** only requests with
   budget in that inclusive range are listed.
4. **Given** a locality filter "Kondapur", **When** applied, **Then** only requests whose
   locality contains "kondapur" (case-insensitive) are listed.
5. **Given** a minimum greater than its maximum, or a negative value, **When** the vendor applies
   filters, **Then** the vendor is told which filter is invalid and the previous results remain.
6. **Given** a vendor whose profile has no base location, **When** the dashboard loads, **Then**
   no distance filter is applied, distances are shown as unavailable, and a prompt explains that
   setting a base location enables distance filtering.
7. **Given** filters that match nothing, **When** applied, **Then** an empty state offers to clear
   filters.

---

### User Story 4 - See open requests and my service area on a map (Priority: P4)

The vendor switches the dashboard to a map view showing each open request as a marker at its
approximate location, the vendor's base location, and a circle for the vendor's service radius.
Selecting a marker shows the same summary as the list card with a link to the detail page. The map
respects the same filters as the list.

**Why this priority**: Product P1 ("Vendor map: open requests and vendor service areas can be
visualized"). It strengthens the demo but the list already delivers the P0 outcome.

**Independent Test**: As a demo vendor with a base location, switch to the map, confirm one marker
per listed request at the rounded location, a service-radius circle centred on the vendor base,
and that applying a filter updates list and map identically.

**Acceptance Scenarios**:

1. **Given** three listed requests, **When** the vendor switches to map view, **Then** three
   markers appear at their approximate locations and a service-radius circle is drawn around the
   vendor's base.
2. **Given** a marker, **When** the vendor selects it, **Then** a summary with locality, units,
   budget, capacity and a "View details" link appears.
3. **Given** an active filter, **When** the vendor switches between list and map, **Then** both
   views show the same set of requests.
4. **Given** the map tiles fail to load, **When** the vendor is in map view, **Then** a message
   offers to switch to the list, and the list continues to work.
5. **Given** a keyboard-only user, **When** they use the dashboard, **Then** the list view (the
   accessible equivalent of the map) remains fully operable and the view toggle is keyboard
   reachable.

---

### Edge Cases

- A request moves from `open` to `accepted` while the vendor is viewing the list: the next load or
  detail open no longer shows it, and the detail page shows the "not found / no longer available"
  state.
- Two requests share the same rounded location: both markers are shown (stacked/offset) and both
  appear in the list.
- A request has no locality text: the card shows "Locality not provided" and the locality filter
  never matches it.
- A request has no preferred capacity: shown as "Not specified"; excluded only while a capacity
  filter is active.
- A request has a roof photo reference but the stored file is missing: detail page shows "Photo
  unavailable" without failing.
- The roof-assessment capability is not yet deployed: the detail page shows "No roof assessment
  available".
- Distance is measured from the vendor's base to the request's approximate (rounded) location, so
  displayed distance is approximate (±~1 km) and labelled "≈".
- Malformed filter values in the address bar (e.g. text in a number field) are rejected with a
  validation message, never silently ignored.
- An unauthenticated visitor opening the vendor dashboard or calling the list is asked to sign in.
- A vendor tries to read household request data directly (bypassing the dashboard): the data store
  returns nothing beyond the permitted fields.
- Large result sets: the list shows at most 200 requests, sorted, with a notice to refine filters
  when the limit is reached.

## Requirements *(mandatory)*

### Functional Requirements

**Discovery list**

- **FR-001**: The system MUST show a signed-in vendor every household request whose status is
  `open` or `quoted`, and no request in any other status.
- **FR-002**: Each listed request MUST show: locality, approximate location, approximate distance
  from the vendor's base (when known), monthly units, budget, preferred capacity (or "Not
  specified"), whether it already has quotes (`quoted`), and posting date.
- **FR-003**: The list MUST default to sorting by nearest approximate distance when the vendor has
  a base location, and by newest first otherwise; the vendor MUST be able to switch to newest first.
- **FR-004**: The list MUST return at most 200 requests per load and tell the vendor when the limit
  was reached.

**Privacy (D-01, constitution IV)**

- **FR-005**: The system MUST NOT disclose to any vendor, in any screen or response, a household's
  exact address text, name, phone, account identifier, exact coordinates, monthly bill, AI-consent
  flag or storage location of the roof photo, before that vendor's quote is accepted.
- **FR-006**: Any location shown or returned to a vendor MUST be the request coordinates rounded to
  2 decimal places (≈1 km).
- **FR-007**: Privacy MUST be enforced by the data store itself, not only by the application: a
  vendor querying household request data directly MUST receive only the permitted fields and only
  for `open`/`quoted` requests.
- **FR-008**: The vendor detail page MUST state that the exact address and contact details are
  shared only after the household accepts the vendor's quote.

**Request detail**

- **FR-009**: Vendors MUST be able to open a detail view for an `open` or `quoted` request showing
  all FR-002 fields plus the roof photo and the latest roof-assessment summary.
- **FR-010**: The roof photo MUST be delivered only through a link that expires in 10 minutes or
  less; a fresh link MUST be issued on each detail load.
- **FR-011**: The roof-assessment summary MUST show only the most recent completed assessment's
  observations, potential obstructions, limitations, site-survey flag and assessment date, labelled
  as AI-generated visible observations that are not a site survey; when none exists the page MUST
  say "No roof assessment available".
- **FR-012**: Requesting the detail of a request that is `draft`, `accepted`, `closed`, or does not
  exist MUST produce the same "not found" outcome, without revealing whether it exists.
- **FR-013**: If the roof photo cannot be retrieved, the detail view MUST still show all other
  details and indicate "Photo unavailable — retry".

**Filters**

- **FR-014**: Vendors MUST be able to filter by maximum distance (km) from their base location, by
  locality text (case-insensitive contains), by preferred-capacity range (kW, inclusive) and by
  budget range (₹, inclusive), individually and combined (logical AND).
- **FR-015**: When the vendor has a base location and service radius, the distance filter MUST
  default to the service radius, with an option to show all distances.
- **FR-016**: When a capacity filter is active, requests without a preferred capacity MUST be
  excluded; when no capacity filter is active they MUST be included.
- **FR-017**: Invalid filter values (negative numbers, non-numbers, minimum above maximum, distance
  above 500 km, locality longer than 100 characters) MUST be rejected with a validation message
  identifying the field; previous results remain displayed.
- **FR-018**: Active filters MUST be visible and clearable in one action, and MUST be reflected in
  the page address so a filtered view can be reloaded.

**Map (product P1)**

- **FR-019**: Vendors MUST be able to switch between list and map views; the map MUST show one
  marker per listed request at its approximate location, the vendor's base location, and a circle
  for the vendor's service radius.
- **FR-020**: List and map MUST always show the same filtered set of requests.
- **FR-021**: Selecting a map marker MUST show the request summary and a link to its detail view.
- **FR-022**: If the map cannot load, the vendor MUST be offered the list view, which MUST keep
  working.

**Access control and errors**

- **FR-023**: Only authenticated users with the vendor role MUST receive the vendor view;
  unauthenticated users MUST be asked to sign in; households MUST continue to receive only their
  own requests through the same request listing and detail operations.
- **FR-024**: Authorization MUST be checked on the server for every discovery and detail
  operation, in addition to the data-store enforcement in FR-007.
- **FR-025**: Errors MUST use the shared error format and MUST NOT expose internal details (stack
  traces, queries, storage paths).
- **FR-026**: The dashboard and detail view MUST implement loading, empty, success and error states.
- **FR-027**: Discovery and detail views MUST be usable on mobile widths, keyboard operable, with
  labelled filter fields and WCAG AA contrast.
- **FR-028**: Demo requests MUST be visibly labelled "Demo" in vendor views.
- **FR-029**: Logs for discovery operations MUST NOT contain household personal data, photo links
  or tokens.

### Key Entities *(include if feature involves data)*

- **Household request (vendor view)**: a read-only, privacy-safe projection of a household request
  in `open` or `quoted` status — identifier, status, locality, approximate latitude/longitude
  (2 decimals), monthly units, budget, preferred capacity, has-photo flag, demo flag and posting
  date. Never includes address, exact coordinates, household identity or monthly bill.
- **Vendor discovery context**: the vendor's own base location, service area text and service
  radius, used for default distance filtering and the map circle.
- **Roof photo link**: a short-lived (≤10 min) link to the request's roof photo, issued per view.
- **Roof assessment summary**: the latest completed assessment's observations, potential
  obstructions, limitations, site-survey flag and date (owned by feature 008).
- **Discovery filters**: max distance, locality text, capacity range, budget range, sort order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A demo vendor can go from sign-in to viewing the detail of a nearby open request in
  under 30 seconds and in at most 3 interactions after the dashboard loads.
- **SC-002**: 100% of vendor-facing responses in the privacy test suite contain no household name,
  phone, address text, monthly bill, account identifier or coordinate with more than 2 decimals.
- **SC-003**: 0 requests in `draft`, `accepted` or `closed` status are visible to vendors across
  the visibility test suite, through both the application and direct data access.
- **SC-004**: For the seeded filter dataset, every filter and filter combination returns exactly
  the expected requests (100% match).
- **SC-005**: Roof-photo links stop working no later than 10 minutes after issue.
- **SC-006**: With up to 200 open requests, the dashboard list is visible within 2 seconds on a
  typical broadband connection.
- **SC-007**: List and map show identical request sets for every filter combination tested.

## Assumptions

- **Dependencies**: `001-platform-foundation-auth` (sign-in, vendor role, `profiles`, `vendors`
  with base location, service area and service radius, shared response/error conventions and
  server-side auth guard, demo accounts); `002-household-solar-request` (household requests,
  their status lifecycle, the private roof-photo store and the household branch of the request
  listing and detail operations, which this feature extends with a vendor branch);
  `008-roof-photo-analysis` (optional at runtime — supplies roof assessments; until it ships the
  detail view shows "No roof assessment available").
- Permitted vendor fields follow D-01 exactly; monthly bill is withheld (data minimisation) because
  monthly units already convey consumption.
- Showing whether a request is `open` or `quoted` (already has quotes) is permitted; the number of
  quotes and other vendors' identities are not shown.
- Distance is computed from the vendor's base location to the request's rounded location, so it is
  approximate and never more precise than the rounded coordinates.
- Vendor base location may be missing (it is optional in the vendor profile); distance features
  degrade gracefully.
- The per-load cap of 200 requests is sufficient for the hackathon dataset; pagination and spatial
  indexing are production concerns (overview §11) and out of MVP scope.
- Default units: distance in km, capacity in kW, budget in whole rupees.
- **Out of Scope**: quote submission and quote history (`005-vendor-quote-submission`); revealing
  household contact and exact address after acceptance, and the accepted vendor's post-acceptance
  view (`007-quote-acceptance`); producing roof assessments (`008-roof-photo-analysis`); editing
  the vendor profile/service area (001); notifications or alerts for new requests; saved searches;
  vendor verification; pagination; geospatial indexing.
