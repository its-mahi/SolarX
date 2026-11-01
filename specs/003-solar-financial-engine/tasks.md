---

description: "Task list for 003 Solar Financial Engine"
---

# Tasks: Solar Financial Engine

**Input**: Design documents from `/specs/003-solar-financial-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED (constitution VI): all domain logic incl. plan §18 "Financial tests",
input validation, authorization/RLS. Test tasks precede the implementation they cover and must
fail first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = estimate for my request, US2 = rules & sources, US3 = what-if capacities

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisites and create shared types

- [ ] T001 Confirm 001/002 prerequisites exist and note their exported helper names for later tasks: envelope/error helpers in src/lib/api/respond.ts and src/lib/api/errors.ts, auth guard in src/lib/api/auth-guard.ts, clients in src/lib/supabase/server.ts and src/lib/supabase/admin.ts, and the `household_requests` migration in supabase/migrations/ (002)
- [ ] T002 [P] Create rule types `Rule`, `RuleSet`, `RuleKey`, `CfaSlab`, `RuleVerification = "illustrative" | "verified"` in src/config/rules/types.ts (fields per data-model.md §3: key, name, value, unit, consumerCategory, geography, sourceTitle, sourceUrl, effectiveDate|null, retrievedOn|null, verification, limitations[])
- [ ] T003 [P] Create `FinancialInputError` (extends Error, `code = "FINANCIAL_INPUT_INVALID"`) in src/lib/domain/financial/errors.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rule set and the core money functions that every story (and feature 006) depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Write rule-set tests in tests/unit/config/rules.test.ts: active set parses with `ruleSetSchema`; version is `pm-surya-ghar.v1`; all 10 rule keys present; every rule has non-empty name, unit, consumerCategory, geography, sourceTitle, sourceUrl (https), limitations; any rule with `verification: "verified"` has non-null `retrievedOn` and `effectiveDate`; every D-06 placeholder and CFA rule is `illustrative` in v1
- [ ] T005 [P] Write CFA tests in tests/unit/financial/cfa.test.ts covering plan §18 verbatim: "1 kW returns ₹30,000 under the configured example rule"; "2 kW returns ₹60,000"; "2.5 kW returns ₹69,000"; "3 kW returns ₹78,000"; "Capacity above 3 kW does not increase the illustrative central CFA" (3.5, 5, 10 kW → 78,000); "Negative capacity is rejected" (−1 throws FinancialInputError); plus 0 → 0, 1.5 → 45,000, NaN and Infinity rejected, result is an integer
- [ ] T006 [P] Write net-cost tests in tests/unit/financial/net-cost.test.ts: 180,000 − 78,000 = 102,000; subsidy > cost → 0 (never negative); negative cost or subsidy throws; non-finite throws
- [ ] T007 [P] Write payback tests in tests/unit/financial/payback.test.ts covering plan §18 verbatim "Zero annual savings does not produce an infinite payback value" (returns `null`, never Infinity); 102,000 / 24,360 ≈ 4.187; net cost 0 → 0; negative or non-finite inputs throw
- [ ] T008 Implement `ruleSetSchema` (Zod; `verified` requires retrievedOn + effectiveDate) in src/lib/validation/rules.ts
- [ ] T009 Implement the v1 rule set in src/config/rules/pm-surya-ghar.v1.ts with exactly the values and metadata in data-model.md §3: cfa_slabs [{0,2,30000},{2,3,18000}], cfa_cap 78000, generation_kwh_per_kw_year 1400, benchmark_cost_per_kw 60000, default_tariff_per_kwh 7.00, tariff_bounds_per_kwh {3.00,12.00}, self_consumption_share 0.70, export_rate_per_kwh 3.00, capacity_range_kw {1,10}, capacity_step_kw 0.5; all `verification: "illustrative"`, `retrievedOn: null`, `effectiveDate: null`, limitations include "Illustrative — verify before demo"; source URLs only https://pmsuryaghar.gov.in/ or https://mnre.gov.in/
- [ ] T010 Export `activeRuleSet` (pm-surya-ghar.v1) in src/config/rules/index.ts
- [ ] T011 [P] Implement `calculateCentralCfa(capacityKw, rules)` (slab sum, cap, Math.round; throws on negative/non-finite) in src/lib/domain/financial/cfa.ts
- [ ] T012 [P] Implement `calculateNetCost(installationCost, subsidy)` = max(0, cost − subsidy) (throws on negative/non-finite) in src/lib/domain/financial/net-cost.ts
- [ ] T013 [P] Implement `calculateSimplePaybackYears(netCost, annualSavings): number | null` (null when savings = 0; throws on negative/non-finite) in src/lib/domain/financial/payback.ts

**Checkpoint**: T004–T007 pass; CFA/net-cost/payback are usable by 006.

---

## Phase 3: User Story 1 - See an indicative solar estimate for my request (Priority: P1) 🎯 MVP

**Goal**: A household sees and saves a full, labelled estimate for its own request.

**Independent Test**: Demo household (250 units, ₹1,50,000 budget, 3 kW preferred) sees 3 kW,
₹1,80,000, ₹78,000, ₹1,02,000, 4,200 kWh, ≈ ₹24,360/yr, ≈ 4.2 yrs with assumptions, version,
source link and disclaimer; reload shows the same saved values; vendor gets 403, other household 404.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T014 [P] [US1] Write capacity tests in tests/unit/financial/capacity.test.ts: 250 units → 2.5 kW recommended (3,000/1,400 = 2.14 rounded up to 0.5); 400 units → 3.5 kW; 30 units → 1 kW with "raised to minimum" note; 2,000 units → 10 kW with "capped" note; preferred 3 kW in range → basis "preferred"; preferred 0.5 or 12 kW → basis "recommended" with "preferred capacity outside supported range" note; monthly units ≤ 0 or non-finite throw
- [ ] T015 [P] [US1] Write generation tests in tests/unit/financial/generation.test.ts: 3 kW × 1,400 = 4,200 kWh (integer); 0 kW → 0; negative throws
- [ ] T016 [P] [US1] Write tariff tests in tests/unit/financial/tariff.test.ts: no bill → 7.00 basis "default"; bill 2,000 / 250 units → 8.00 "derived_from_bill"; bill 50 / 300 units → 3.00 "derived_from_bill_clamped"; bill 6,000 / 300 → 12.00 clamped; bill 0 → default
- [ ] T017 [P] [US1] Write savings tests in tests/unit/financial/savings.test.ts: demo case 4,200 kWh gen, 3,000 kWh consumption, ₹7, share 0.70, export ₹3 → self 2,940, exported 1,260, savings 24,360; oversized system (gen 14,000, consumption 3,000) → self-consumed capped at 3,000 and the rest at export rate; result is strictly less than gen × tariff whenever share < 1 (no full-tariff assumption); zero generation → 0; negative/non-finite inputs throw
- [ ] T018 [P] [US1] Write estimate tests in tests/unit/financial/estimate.test.ts: demo request yields all seven values above with `ruleVersion: "pm-surya-ghar.v1"`; plan §18 "Assumptions and rule version are visible" — output includes `ruleVersion` and an `assumptions` object containing inputs, every rule value used, capacityBasis, tariffBasis, selfConsumedKwh, exportedKwh, illustrativeRuleKeys and notes; budget 1,50,000 < cost 1,80,000 adds the over-budget note; zero-savings configuration → `paybackYears: null`; same inputs twice → deep-equal output (determinism); output parses with the response schema
- [ ] T019 [P] [US1] Write input-validation tests in tests/unit/validation/solar.test.ts for `calculateRequestSchema`: valid `{requestId}`; invalid uuid; `inputs.monthlyUnits` missing, 0, −5, 10,001, "250", NaN rejected; `monthlyBill` −1, 1,000,001, 12.5 rejected; `budget` −1 rejected; `preferredCapacityKw` 0 and 101 rejected; unknown keys rejected; both `requestId` and `inputs` rejected
- [ ] T020 [P] [US1] Write endpoint integration tests in tests/integration/api/solar-calculate.test.ts (local Supabase, demo users): owner `{requestId}` → 200 `saved: true` and one `solar_estimates` row; second call after changing `monthly_units` replaces the row (still one row, new values); response includes assumptions, ruleVersion, disclaimer; anonymous → 401; vendor → 403; other household → 404; request without monthly_units → 409; malformed body → 400 with details; error bodies contain no SQL or stack text
- [ ] T021 [P] [US1] Write RLS tests in tests/integration/rls/solar-estimates.test.ts: owner can select own estimate; other household, vendor and anon select 0 rows; authenticated insert, update and delete via the browser (anon key + user JWT) are denied for the owner too

### Implementation for User Story 1

- [ ] T022 [P] [US1] Implement `recommendCapacityKw(monthlyUnits, rules)` and `chooseEstimateCapacity(inputs, rules)` (ceil to 0.5 kW, clamp 1–10 kW, notes, basis) in src/lib/domain/financial/capacity.ts
- [ ] T023 [P] [US1] Implement `estimateAnnualGenerationKwh(capacityKw, rules)` in src/lib/domain/financial/generation.ts
- [ ] T024 [P] [US1] Implement `resolveTariff({monthlyUnits, monthlyBill}, rules)` returning `{ tariffPerKwh, tariffBasis }` in src/lib/domain/financial/tariff.ts
- [ ] T025 [P] [US1] Implement `estimateAnnualSavings({annualGenerationKwh, annualConsumptionKwh, tariffPerKwh, selfConsumptionShare, exportRatePerKwh})` returning `{ annualSavings, selfConsumedKwh, exportedKwh }` in src/lib/domain/financial/savings.ts
- [ ] T026 [US1] Implement `buildSolarEstimate(inputs, rules, options?)` composing T011–T013 and T022–T025 with rounding (rupees, kWh, payback 1 dp, capacity 2 dp), fixed note strings and `illustrativeRuleKeys`, in src/lib/domain/financial/estimate.ts
- [ ] T027 [US1] Export the public financial API (calculateCentralCfa, calculateNetCost, calculateSimplePaybackYears, recommendCapacityKw, buildSolarEstimate, types) for reuse by 006 and 011 in src/lib/domain/financial/index.ts
- [ ] T028 [P] [US1] Implement `calculateRequestSchema` (strict union of `{requestId, capacityOverrideKw?}` and `{inputs, capacityOverrideKw?}` with bounds: monthlyUnits >0 ≤10,000; monthlyBill int 0..1,000,000; budget int 0..10,000,000; preferredCapacityKw >0 ≤100), `solarEstimateAssumptionsSchema`, `solarEstimateSchema` and the `ESTIMATE_DISCLAIMER` constant in src/lib/validation/solar.ts
- [ ] T029 [P] [US1] Write migration supabase/migrations/20261101000300_solar_estimates.sql: table `solar_estimates` per data-model.md §1 (`request_id` uuid not null unique references household_requests(id) on delete cascade; `capacity_kw numeric(5,2)` check > 0 and ≤ 100; integer money columns check ≥ 0; `payback_years numeric(5,1)` nullable check ≥ 0; `assumptions jsonb not null default '{}'`; `rule_version text not null` length 1..64; created_at/updated_at), enable RLS, policy `solar_estimates_select_owner` only (no insert/update/delete policies)
- [ ] T030 [US1] Implement `POST /api/solar/calculate` save mode in src/app/api/solar/calculate/route.ts: parse → `calculateRequestSchema` → auth guard (household; vendor 403; anon 401) → load request inputs via user-scoped client (missing → 404; null monthly_units → 409) → `buildSolarEstimate(…, activeRuleSet)` → upsert on `request_id` via admin client → `{ data: { saved, estimate, disclaimer } }`; map errors to the shared envelope; log only `{event, requestId, ruleVersion}` (no bill, budget or address)
- [ ] T031 [P] [US1] Implement `EstimateBadge` (`kind: "estimate" | "vendor-confirmed"`, distinct colour + icon + text, AA contrast) in src/components/shared/estimate-badge.tsx
- [ ] T032 [US1] Implement `EstimateCard` per contracts/rules.md UI contract in src/components/shared/estimate-card.tsx: props `{ request: HouseholdRequestDto, variant: "review" | "detail" | "card", showWhatIf? }`; calls the endpoint on mount and when the derived inputs key (monthly_units, monthly_bill, budget, preferred_capacity_kw) changes; shows seven values each with `EstimateBadge`, recommended capacity and basis, "Not applicable — no estimated savings" for null payback, assumptions disclosure, notes (incl. over-budget), rule version, link to /rules, "Illustrative" marker, disclaimer (compact subset for `card`); loading skeleton, empty state on 409, error state with Retry; mobile-first, labelled, keyboard operable
- [ ] T033 [US1] Fill the body of 002's `RequestEstimateSlot` to render `<EstimateCard request={request} variant={variant} />` in src/components/household/extension-slots.tsx (change only that slot body; host pages and slot prop types stay as 002 defined them)

**Checkpoint**: US1 independently testable; the estimate appears on the review step, request page and dashboard card.

---

## Phase 4: User Story 2 - Read the rules and sources behind the numbers (Priority: P2)

**Goal**: Public page and API listing every rule with full source metadata.

**Independent Test**: Signed out, open /rules: every rule with all metadata, illustrative markers,
CFA table 30k/45k/60k/69k/78k/78k, official links and disclaimer.

### Tests for User Story 2 ⚠️

- [ ] T034 [P] [US2] Write integration test in tests/integration/api/rules.test.ts: anonymous GET /api/rules → 200; `version` = pm-surya-ghar.v1; every rule has all metadata fields; `cfaExamples` equals [1→30000, 1.5→45000, 2→60000, 2.5→69000, 3→78000, 5→78000]; officialReferences contains the three plan §22 portals; disclaimer present

### Implementation for User Story 2

- [ ] T035 [US2] Implement `GET /api/rules` (public, no DB, `Cache-Control: public, max-age=300`, cfaExamples computed with `calculateCentralCfa`) in src/app/api/rules/route.ts
- [ ] T036 [P] [US2] Implement `RulesTable` (table on ≥ md with `<th scope>`, stacked cards on mobile; value+unit, category, geography, source link with rel="noopener noreferrer", effective date, retrieval date or "Pending verification", verification badge, limitations) in src/components/shared/rules-table.tsx
- [ ] T037 [US2] Implement the public rules & sources page (version header, illustrative banner, RulesTable, CFA examples table, official references, disclaimer) in src/app/rules/page.tsx
- [ ] T038 [P] [US2] Add loading skeleton in src/app/rules/loading.tsx and error state with Retry (`reset()`) in src/app/rules/error.tsx
- [ ] T039 [US2] Add a "Rules & sources" link to the landing page footer in src/app/page.tsx (001-owned file; additive link only, no other change)

**Checkpoint**: US1 and US2 work independently.

---

## Phase 5: User Story 3 - Try "what if" capacities without saving (Priority: P3)

**Goal**: Unsaved previews for alternative capacities from the estimate card.

**Independent Test**: Select 2, 3, 5 kW → subsidy 60k, 78k, 78k with "Preview — not saved"; reload
shows the saved estimate unchanged.

### Tests for User Story 3 ⚠️

- [ ] T040 [P] [US3] Add preview cases to tests/unit/financial/estimate.test.ts: `capacityOverrideKw` 2 / 3 / 5 → subsidy 60,000 / 78,000 / 78,000, basis "preview"; override outside 1–10 kW throws
- [ ] T041 [P] [US3] Add preview cases to tests/integration/api/solar-calculate.test.ts: `{requestId, capacityOverrideKw: 5}` → 200 `saved: false` and the stored row is unchanged; `{inputs:{monthlyUnits:250}}` → 200 `saved: false`, no row created; vendor calling preview → 403; override 0.5 → 400

### Implementation for User Story 3

- [ ] T042 [US3] Support `options.capacityOverrideKw` (validate within capacity_range_kw; basis "preview") in src/lib/domain/financial/estimate.ts
- [ ] T043 [US3] Add both preview modes (never write) to src/app/api/solar/calculate/route.ts
- [ ] T044 [P] [US3] Implement `WhatIfCapacity` (labelled select 1–10 kW in 0.5 steps, keyboard operable) in src/components/shared/what-if-capacity.tsx
- [ ] T045 [US3] Integrate the what-if control into src/components/shared/estimate-card.tsx behind `showWhatIf`: preview panel labelled "Preview — not saved", note "Central subsidy does not increase above 3 kW under the configured rule" when capacity > 3, own loading/error state

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T046 [P] Write Playwright check in tests/e2e/financial-estimate.spec.ts (plan §18 "Assumptions and rule version are visible"): demo household sees the estimate card with assumptions, `pm-surya-ghar.v1`, disclaimer and rules link; anonymous /rules shows all rules and the CFA table
- [ ] T047 Review error mapping and logging in src/app/api/solar/calculate/route.ts and src/app/api/rules/route.ts: shared envelope only, generic INTERNAL message, logs contain ids/version only
- [ ] T048 Pre-demo verification: check each rule in src/config/rules/pm-surya-ghar.v1.ts against https://pmsuryaghar.gov.in/ and https://mnre.gov.in/; record retrievedOn/effectiveDate/sourceTitle; set `verified` only where confirmed, otherwise leave `illustrative`; bump to pm-surya-ghar.v2.ts if any value changes
- [ ] T049 Run lint, type-check and all 003 tests, then the manual walkthrough in specs/003-solar-financial-engine/quickstart.md

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T013)** → US1 (T014–T033) → US2 (T034–T039) and
  US3 (T040–T045) → Polish (T046–T049).
- US2 depends only on Foundational (rule set + CFA) and can run in parallel with US1.
- US3 depends on US1 (route, estimate builder, card).
- Feature 006 can start using `src/lib/domain/financial/` after Phase 2 + T027.
- Within a story: tests → domain → validation/migration → route → UI.

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "T014 capacity tests in tests/unit/financial/capacity.test.ts"
Task: "T017 savings tests in tests/unit/financial/savings.test.ts"
Task: "T020 endpoint tests in tests/integration/api/solar-calculate.test.ts"
# Domain functions together:
Task: "T022 capacity.ts"  Task: "T023 generation.ts"  Task: "T024 tariff.ts"  Task: "T025 savings.ts"
# Independent files together:
Task: "T028 src/lib/validation/solar.ts"  Task: "T029 migration"  Task: "T031 estimate-badge.tsx"
```

## Implementation Strategy

1. Phase 1–2 first (≈ 30 min): unblocks 006 and gives the plan §18 CFA/payback tests.
2. US1 → validate with quickstart rows 1–6 → hand `EstimateCard` to 002. **MVP.**
3. US2 (rules page) — required for the judge question "where does the subsidy come from?".
4. US3 if time allows.

## Requirement Coverage

| FR | Tasks |
|---|---|
| FR-001 | T002, T008, T009, T010 |
| FR-002 | T002, T004, T008, T009 |
| FR-003 | T004, T009 |
| FR-004 | T004, T009, T048 |
| FR-005 | T005, T011 |
| FR-006 | T005, T011, T019 |
| FR-007 | T006, T012 |
| FR-008 | T014, T022 |
| FR-009 | T014, T022, T026 |
| FR-010 | T018, T026, T032 |
| FR-011 | T015, T023 |
| FR-012 | T017, T025 |
| FR-013 | T016, T024 |
| FR-014 | T007, T013, T018 |
| FR-015 | T018, T026 |
| FR-016 | T027 |
| FR-017 | T019, T028, T030 |
| FR-018 | T020, T029, T030 |
| FR-019 | T020, T030, T032 |
| FR-020 | T020, T021, T029, T030 |
| FR-021 | T041, T042, T043 |
| FR-022 | T034, T035 |
| FR-023 | T018, T032, T033, T046 |
| FR-024 | T031, T032 |
| FR-025 | T032, T033 |
| FR-026 | T018, T032 |
| FR-027 | T034, T036, T037, T038, T039 |
| FR-028 | T040, T044, T045 |
| FR-029 | T020, T030, T047 |
| FR-030 | T030, T047 |

## Notes

- [P] = different files, no dependency on incomplete tasks.
- Placeholder values are illustrative (research.md R-05..R-08); never present them as official.
- Domain files must not import Next.js, Supabase or React.
