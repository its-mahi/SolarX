# Feature Specification: Solar Financial Engine

**Feature Branch**: `003-solar-financial-engine`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Solar financial engine (P0): a versioned, sourced rule configuration for PM Surya Ghar subsidy and sizing rules; deterministic calculation of indicative system capacity, central subsidy (CFA), net cost, annual generation, annual savings (with a self-consumption share, not every unit at full retail tariff) and simple payback (no value when savings are zero); persistence of one estimate per household request; a public rules and sources page; and a reusable estimate card shown on the household dashboard and the request wizard's review step. Generation per kW, benchmark installation cost per kW and tariff are configurable illustrative values that must be verified before the demo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See an indicative solar estimate for my request (Priority: P1)

A household that has entered its monthly electricity consumption (and optionally its monthly bill, budget and preferred capacity) sees an indicative estimate for its request: recommended system capacity, benchmark installation cost, estimated central subsidy (CFA), estimated net cost, estimated annual generation, estimated annual savings and simple payback. Every number is labelled as an estimate, lists the assumptions used, names the rule version and source, and carries an eligibility disclaimer. The estimate is saved against the request so that the dashboard, the wizard review step and later features (quote comparison, advisor) all show the same values.

**Why this priority**: The financial calculator is a P0 acceptance condition ("subsidy and payback are calculated in code with assumptions") and 20% of judging rewards code-calculated numbers. It also gives a household value before any vendor has quoted.

**Independent Test**: Using the demo household request (250 units/month, budget ₹1,50,000, preferred 3 kW), request an estimate and verify that all seven values are shown, that the subsidy for 3 kW is ₹78,000 under the illustrative baseline, that assumptions, rule version, source and disclaimer are visible, and that reloading the page shows the same saved values.

**Acceptance Scenarios**:

1. **Given** a household owns a request with monthly consumption entered, **When** the household opens its dashboard or the wizard review step, **Then** an estimate card shows capacity, installation cost, subsidy estimate, net cost, annual generation, annual savings and payback, each labelled "estimate".
2. **Given** the request has a preferred capacity of 3 kW, **When** the estimate is calculated, **Then** the estimate uses 3 kW, shows a subsidy estimate of ₹78,000, and also shows the consumption-based recommended capacity for reference.
3. **Given** the request has no preferred capacity, **When** the estimate is calculated, **Then** the capacity is the consumption-based recommendation, rounded up to the nearest 0.5 kW and kept within the supported range.
4. **Given** an estimate has been calculated, **When** the household views it, **Then** the card lists every assumption used (generation per kW, benchmark cost per kW, tariff and whether it was derived from the bill, self-consumption share, export rate), the rule version, a link to the rules and sources page, an "illustrative — verify before relying on it" marker for any unverified rule, and a disclaimer that subsidy eligibility and payment are decided by the official scheme.
5. **Given** the household changes its monthly consumption or preferred capacity, **When** the estimate is shown again, **Then** it is recalculated from the new inputs and the saved estimate is replaced.
6. **Given** the computed annual savings are zero, **When** the estimate is shown, **Then** payback is displayed as "not applicable" rather than an infinite or very large number.
7. **Given** a request has no monthly consumption yet, **When** the estimate card is shown, **Then** it shows an empty state asking the household to enter consumption, and no estimate is saved.
8. **Given** another household or a vendor, **When** they try to calculate or read this household's estimate, **Then** they are refused and no estimate data is disclosed.

---

### User Story 2 - Read the rules and sources behind the numbers (Priority: P2)

Anyone, signed in or not, can open a rules and sources page that lists every rule the estimate uses: rule name and value, consumer category, geography, source title and link, effective date, retrieval date, internal rule version, verification status and limitations. The page states clearly that values are an illustrative baseline until verified against official sources and that the platform does not guarantee subsidy eligibility or payment.

**Why this priority**: The hackathon brief requires showing where subsidy and sizing rules come from, and judges will ask how incorrect subsidy values are prevented. It depends on the rule configuration from Story 1 but adds no calculation.

**Independent Test**: Without signing in, open the rules and sources page and verify that each rule used by the estimate appears with all metadata fields, that the CFA slabs and cap are shown, that illustrative rules are visibly marked, and that the eligibility disclaimer is present.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they open the rules and sources page, **Then** they see every configured rule with its name, value and unit, consumer category, geography, source title and link, effective date, retrieval date (or "pending verification"), rule version, verification status and limitations.
2. **Given** a rule is marked illustrative, **When** it is listed, **Then** it carries an "Illustrative — verify before demo" marker.
3. **Given** the estimate card, **When** the household follows its "rules and sources" link, **Then** it lands on this page showing the same rule version that produced the estimate.
4. **Given** the rule information cannot be loaded, **When** the page is opened, **Then** an error state with a retry action is shown.

---

### User Story 3 - Try "what if" capacities without saving (Priority: P3)

From the estimate card, a household can try a few alternative capacities (for example 2, 3 or 4 kW) to see how installation cost, subsidy, net cost, savings and payback change, including that the central subsidy stops increasing above 3 kW. These previews are not saved and do not change the request.

**Why this priority**: It makes the subsidy structure understandable and demonstrates the cap in a live demo, but the core estimate works without it.

**Independent Test**: On the demo request, select 2 kW, 3 kW and 5 kW in the what-if control and verify subsidies of ₹60,000, ₹78,000 and ₹78,000, that net cost and payback update, that a "preview — not saved" label is shown, and that the saved estimate is unchanged after reload.

**Acceptance Scenarios**:

1. **Given** a saved estimate, **When** the household selects an alternative capacity, **Then** a preview estimate for that capacity is shown, labelled "preview — not saved", using the same request inputs and rule version.
2. **Given** a preview of 5 kW, **When** compared with 3 kW, **Then** the subsidy estimate is identical (₹78,000) and the card explains that central subsidy does not increase above 3 kW under the configured rule.
3. **Given** a preview is shown, **When** the household reloads the page, **Then** the saved estimate (not the preview) is displayed.

---

### Edge Cases

- Capacity is negative, not a number, or infinite: the calculation is rejected with a validation error; no estimate is produced.
- Capacity is exactly 0: subsidy is ₹0; this is only reachable in direct calculations, as the estimate always uses at least the minimum supported capacity.
- Capacity above 3 kW (e.g. 5 kW or 10 kW): subsidy stays at the ₹78,000 cap.
- Fractional capacities (e.g. 1.5 kW, 2.5 kW): subsidy is pro-rated per kW inside each slab (₹45,000 and ₹69,000).
- Subsidy larger than installation cost: net cost is ₹0, never negative.
- Annual savings of zero: payback is "not applicable" (no value), never infinite.
- Very low consumption (e.g. 30 units/month): the recommendation is raised to the minimum supported capacity and a note says so.
- Very high consumption: the recommendation is capped at the maximum supported residential capacity and a note says so.
- Preferred capacity outside the supported range: it is not used; the recommended capacity is used and a note explains why.
- Monthly bill entered that implies an implausible tariff (e.g. ₹50 bill for 300 units): the derived tariff is held within the configured bounds and a note says so.
- Monthly consumption missing: no estimate; the card shows the empty state.
- Generation larger than the household's own consumption: units above consumption are valued only at the export rate, not the retail tariff.
- Estimated installation cost above the household's budget: the estimate is still shown, with a note that the upfront cost before subsidy exceeds the stated budget.
- The rule configuration is changed to a new version: the next calculation uses and records the new version; older saved estimates show the version that produced them until recalculated.
- Rounding: money is shown in whole rupees; payback to one decimal place; capacity to two decimal places at most.

## Requirements *(mandatory)*

### Functional Requirements

**Rule configuration**

- **FR-001**: The system MUST keep every subsidy, sizing and savings rule in one versioned rule configuration that is separate from screens and display logic, identified by an internal rule version.
- **FR-002**: Each rule MUST record: rule name and value (with unit), consumer category, geographic applicability, source title and source link, effective date, retrieval date (or a "pending verification" state), internal rule version, verification status (illustrative or verified) and limitations/assumptions.
- **FR-003**: The rule configuration MUST contain, at minimum: the central CFA slabs (₹30,000 per kW for the first 2 kW, ₹18,000 per kW for the next 1 kW, nothing above 3 kW) and cap (₹78,000); expected annual generation per kW; benchmark installation cost per kW; default electricity tariff and its allowed bounds when derived from a bill; self-consumption share; export rate for units not self-consumed; minimum and maximum supported capacity; and the capacity rounding step.
- **FR-004**: The CFA values, generation per kW, benchmark cost per kW, tariff, tariff bounds, self-consumption share and export rate MUST be marked illustrative ("verify before demo") until replaced with values verified against official sources; the product MUST never present them as current official rules.

**Calculations (deterministic)**

- **FR-005**: The system MUST calculate the central CFA estimate for a capacity as the sum over slabs of (capacity falling in the slab × slab rate), limited to the configured cap. Under the illustrative baseline: 1 kW → ₹30,000; 1.5 kW → ₹45,000; 2 kW → ₹60,000; 2.5 kW → ₹69,000; 3 kW → ₹78,000; any capacity above 3 kW → ₹78,000.
- **FR-006**: The system MUST reject a capacity that is negative, not a number or not finite, rather than produce a value.
- **FR-007**: The system MUST calculate net cost as installation cost minus subsidy estimate, never below zero, and MUST reject negative amounts.
- **FR-008**: The system MUST recommend a capacity as annual consumption (monthly units × 12) divided by expected annual generation per kW, rounded up to the configured step (0.5 kW) and kept within the supported minimum and maximum capacity, with a note whenever the value was raised or capped.
- **FR-009**: The capacity used for the estimate MUST be the household's preferred capacity when provided and within the supported range; otherwise the recommended capacity. The estimate MUST record which basis was used and always show the recommended capacity for reference.
- **FR-010**: The system MUST estimate installation cost as capacity × benchmark installation cost per kW, rounded to whole rupees, and label it as a benchmark, not a vendor price.
- **FR-011**: The system MUST estimate annual generation as capacity × expected annual generation per kW, in whole kWh.
- **FR-012**: The system MUST estimate annual savings without assuming every generated unit offsets the full retail tariff: self-consumed units = the lesser of (generation × self-consumption share) and annual consumption; they are valued at the applicable tariff; all remaining generated units are valued at the export rate. The result is whole rupees and never negative.
- **FR-013**: The applicable tariff MUST be the configured default tariff, unless the household provided a monthly bill greater than zero, in which case it is the bill divided by monthly units, held within the configured tariff bounds; the estimate MUST record which tariff was used and how it was obtained.
- **FR-014**: The system MUST calculate simple payback as net cost ÷ annual savings, shown to one decimal place, and MUST return "no value" (displayed as "not applicable") when annual savings are zero; negative inputs MUST be rejected.
- **FR-015**: All calculations MUST be deterministic: the same inputs and rule version always produce the same outputs. No AI capability may compute, adjust or override any of these values.
- **FR-016**: The calculations MUST be reusable by other features (in particular quote comparison computing a per-quote subsidy and net cost) using the same rule configuration.

**Inputs and validation**

- **FR-017**: The system MUST validate calculation inputs on the server: monthly units required, a number greater than 0 and at most 10,000; monthly bill optional, a whole number from 0 to 1,000,000 rupees; budget optional, a whole number from 0 to 10,000,000 rupees; preferred capacity optional, a number greater than 0 and at most 100 kW. Invalid input MUST return a validation error listing the offending fields.

**Persistence and access**

- **FR-018**: The system MUST store at most one saved estimate per household request, containing capacity, installation cost, subsidy estimate, net cost, annual generation, annual savings, payback (or no value), the full set of assumptions and inputs used, and the rule version; recalculating MUST replace it.
- **FR-019**: Calculating a saved estimate for a request MUST read the inputs stored on that request, so that saved values always correspond to the request's current inputs; recalculation MUST be available whenever the request's inputs change.
- **FR-020**: Only the household that owns a request MAY calculate, save or read its estimate; vendors, other households and anonymous users MUST be refused, both by the server and by data-level access rules. Saved estimate values MUST NOT be writable directly by any user; only the server's calculation may write them.
- **FR-021**: The system MUST offer an unsaved preview calculation for a signed-in household (used by the what-if control) that returns the same estimate structure without storing anything.
- **FR-022**: The rule information MUST be publicly readable without signing in.

**Display**

- **FR-023**: Every displayed estimate MUST show its assumptions, rule version, source link (to the rules and sources page), "estimate"/"indicative" wording, an "illustrative" marker for unverified rules, and the disclaimer: "Estimates only. Subsidy eligibility, approval and payment are decided under the official PM Surya Ghar scheme; SURYAMIT does not guarantee them."
- **FR-024**: The estimate card MUST visually distinguish platform estimates from vendor-confirmed values using a consistent "Estimate" marker that other features reuse.
- **FR-025**: The estimate card MUST implement loading, empty (no consumption entered), success and error (with retry) states, and MUST be usable on the household dashboard and on the request wizard's review step.
- **FR-026**: The estimate card MUST show a note when the estimated upfront installation cost exceeds the household's stated budget.
- **FR-027**: The rules and sources page MUST list every configured rule with all metadata from FR-002, the CFA example table, the eligibility disclaimer and links to the official portals named in the project plan, and MUST implement loading and error states.
- **FR-028**: The what-if control MUST let the household choose an alternative capacity within the supported range, show the preview labelled "preview — not saved", and explain that central subsidy does not increase above 3 kW.

**Errors and privacy**

- **FR-029**: Errors MUST use the shared error format and MUST NOT expose stack traces, database messages or internal configuration beyond the published rules.
- **FR-030**: Logs for this feature MUST record only calculation failures and estimate saves by identifier, never monthly bill, budget, address or other personal data.

### Key Entities *(include if feature involves data)*

- **Rule configuration (rule set)**: A versioned collection of rules. Each rule has a name, value and unit, consumer category, geography, source title and link, effective date, retrieval date, version, verification status and limitations. One rule set is active at a time.
- **Calculation inputs**: Monthly units (required), monthly bill, budget and preferred capacity (optional), taken from the household request.
- **Solar estimate**: The saved result for one household request: capacity, installation cost, subsidy estimate, net cost, annual generation, annual savings, payback (or none), assumptions (inputs, rule values used, capacity basis, tariff basis, notes) and rule version. Belongs to exactly one household request; replaced on recalculation.
- **Estimate preview**: The same structure as a solar estimate, computed on demand for an alternative capacity and never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the plan's financial test cases pass: 1 kW → ₹30,000; 2 kW → ₹60,000; 2.5 kW → ₹69,000; 3 kW → ₹78,000; capacity above 3 kW does not increase the CFA; negative capacity is rejected; zero annual savings never produce an infinite payback; assumptions and rule version are visible.
- **SC-002**: For identical inputs and rule version, 100% of repeated calculations produce identical results.
- **SC-003**: Every displayed estimate (100%) shows assumptions, rule version, a source link and the eligibility disclaimer.
- **SC-004**: A household with consumption entered sees its estimate within 2 seconds of opening the dashboard or review step.
- **SC-005**: An anonymous visitor can reach the rules and sources page in one click from the landing page or estimate card and see every rule with all metadata fields filled (or explicitly "pending verification").
- **SC-006**: 0 successful reads or writes of another household's estimate in authorization tests.
- **SC-007**: In a demo walkthrough, a viewer can state where the subsidy figure came from and that it is not guaranteed, after viewing the estimate card once.

## Assumptions

- **Placeholder values (illustrative — must be verified before the demo)**: expected generation 1,400 kWh per kW per year; benchmark installation cost ₹60,000 per kW; default tariff ₹7.00 per kWh with bill-derived tariffs held between ₹3.00 and ₹12.00 per kWh; self-consumption share 70%; export rate ₹3.00 per kWh; supported capacity 1–10 kW; rounding step 0.5 kW. Reasoning is recorded in `research.md`. The CFA slabs and cap are the constitution's illustrative baseline. None of these are claimed as official; each must be checked against pmsuryaghar.gov.in / mnre.gov.in and its retrieval date recorded.
- State top-ups (e.g. Telangana), DISCOM-specific net-metering rules, fixed charges, degradation, taxes and financing are not modelled; this is stated as a limitation on the card and the rules page.
- The budget is compared with the upfront installation cost before subsidy, because the household normally pays the vendor before the subsidy is credited.
- The estimate is recalculated on demand when the card is shown (calculation is instant), which keeps the saved estimate in line with the request's current inputs without a separate synchronisation step.
- Rule changes are made by developers editing the configuration and bumping its version; there is no admin editing screen in the MVP.
- Only households calculate estimates; vendors do not see household estimates in the MVP.
- **Dependencies**: `001-platform-foundation-auth` (application shell, sign-in and roles, shared response and error format, server authorization helper, data access clients, test tooling). `002-household-solar-request` (household requests holding monthly units, monthly bill, budget and preferred capacity; the dashboard and wizard review step that host the estimate card). The pure calculations have no dependency and can be built first. `006-quote-comparison-scoring` reuses the CFA and net-cost calculations; `011-ai-solar-advisor` reads saved estimates.
- **Out of scope**: official eligibility checks; state subsidy top-ups; loan/EMI or financing; tariff slab modelling; shading, tilt, orientation or degradation modelling; an admin screen to edit rules; government application submission; any AI-produced number.
