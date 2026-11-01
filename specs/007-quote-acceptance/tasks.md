---

description: "Task list for 007 Quote Acceptance"
---

# Tasks: Quote Acceptance

**Input**: Design documents from `/specs/007-quote-acceptance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED (constitution VI): acceptance atomicity (double-accept race), accepting a
withdrawn or rejected quote, non-owner attempts, status cascade correctness, authorization/RLS and
the P0 end-to-end flow. Test tasks precede the implementation they cover and must fail first.

**Organization**: US1 = accept with confirmation, US2 = accepted / next steps, US3 = vendor outcome
and contact reveal, US4 = close request.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm prerequisites and record exact exported names: 001's `requireRole`, `assertSameOrigin` (src/lib/api/auth-guard.ts), `ok`/`withApiHandler`/`parseJsonBody` (src/lib/api/respond.ts), `ApiError`/`toErrorResponse` (src/lib/api/errors.ts), `logEvent` (src/lib/api/log.ts), `REQUEST_STATUSES`/`QUOTE_STATUSES` (src/lib/validation/enums.ts); 002's `canTransition` (src/lib/domain/requests/status.ts), status guard trigger allowing SECURITY DEFINER updates, and slots in src/components/household/extension-slots.tsx; 005's `quotes` migration, `withdraw_quote`, `quoteIdParamSchema` and src/components/quotes/quote-history.tsx; 006's `actionSlot` in src/components/quotes/quote-card.tsx and src/app/api/requests/[id]/quotes/route.ts
- [X] T002 [P] Create Zod schemas in src/lib/validation/acceptance.ts per data-model.md §4: `acceptQuoteBodySchema` and `closeRequestBodySchema` = `{ confirmed: z.literal(true) }.strict()`, `acceptanceResultSchema`, `householdContactSchema`, `acceptanceSummarySchema` (nullable); reuse enums from src/lib/validation/enums.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Write unit tests in tests/unit/requests/acceptance.test.ts: `canAcceptQuote` true only for request `open`/`quoted` AND quote `submitted` (all 5×4 combinations); `canCloseRequest` true only for `accepted`; `quoteOutcomeLabel` → "Accepted…" / "Not selected — the household accepted another quote" / null
- [X] T004 [P] Implement `canAcceptQuote`, `canCloseRequest`, `quoteOutcomeLabel` using 002's `canTransition` in src/lib/domain/requests/acceptance.ts (pure, no I/O)
- [X] T005 [P] Write RLS/constraint tests in tests/integration/rls/quote-acceptances.test.ts: owning household selects its row; accepted vendor selects its row; rejected vendor, other household and anon select 0 rows; authenticated INSERT/UPDATE/DELETE denied for everyone (incl. owner); service-role insert of a second row with the same `request_id` fails with 23505 and with the same `quote_id` fails with 23505
- [X] T006 Create migration supabase/migrations/20261101000700_quote_acceptances.sql (table part): `quote_acceptances` per data-model.md §1 — `quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE` with `CONSTRAINT quote_acceptances_quote_id_key UNIQUE (quote_id)`, `request_id uuid NOT NULL REFERENCES household_requests(id) ON DELETE CASCADE` with `CONSTRAINT quote_acceptances_request_id_key UNIQUE (request_id)`, `household_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `accepted_at timestamptz NOT NULL DEFAULT now()`, `created_at timestamptz NOT NULL DEFAULT now()`; index `quote_acceptances_household_id_idx`; `ENABLE ROW LEVEL SECURITY`; SELECT policies `quote_acceptances_select_household` and `quote_acceptances_select_accepted_vendor` exactly as data-model.md §1; no INSERT/UPDATE/DELETE policies (comment why)
- [X] T007 [P] Implement SQLSTATE → API error mapping per research.md R-05 (42501→FORBIDDEN; SM404→NOT_FOUND; SM409 ALREADY_ACCEPTED/REQUEST_NOT_ACCEPTING/QUOTE_NOT_ACCEPTABLE/REQUEST_NOT_CLOSABLE→CONFLICT with `details[0].reason`; SM403 CONTACT_NOT_AVAILABLE/VENDOR_PROFILE_MISSING→FORBIDDEN; 23505 on the acceptance keys→CONFLICT ALREADY_ACCEPTED; else INTERNAL with generic message) in src/app/api/quotes/_lib/map-acceptance-db-error.ts

**Checkpoint**: T003 and T005 pass.

---

## Phase 3: User Story 1 - Accept one quote with explicit confirmation (Priority: P1) 🎯 MVP

**Goal**: Confirmed, atomic, single acceptance with full status cascade; repeats and races → 409.

**Independent Test**: Accept SunRise on the demo request → SunRise accepted, others rejected,
request accepted, one acceptance row; two simultaneous attempts → one 200 + one 409.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T008 [P] [US1] Write cascade tests in tests/integration/acceptance/accept-cascade.test.ts: request `quoted` with quotes A, B (submitted) and C (withdrawn beforehand) → accept A → 200 with `rejectedQuoteIds = [B]`; A `accepted`, B `rejected`, C still `withdrawn`; request `accepted`; exactly one `quote_acceptances` row with correct `quote_id`, `request_id`, `household_id`; also from a request in `open` status (quote inserted by fixture) → request `accepted`; 005's `GET /api/quotes/mine` for each vendor shows the new statuses
- [X] T009 [P] [US1] Write rule tests in tests/integration/acceptance/accept-rules.test.ts, each asserting nothing changed afterwards (statuses + acceptance count snapshot): withdrawn quote → 409 `QUOTE_NOT_ACCEPTABLE`; rejected quote (fixture sets a quote `rejected` on an open request via service role) → 409 `QUOTE_NOT_ACCEPTABLE`; rejected quote after another acceptance → 409; second accept of the same quote → 409 `ALREADY_ACCEPTED`; closed request → 409; non-owner household → 404; vendor (incl. the quote's own vendor) → 403; anonymous → 401; body `{}`, `{confirmed:false}`, extra key → 400; non-uuid id → 400; unknown quote id → 404; direct `rpc('accept_quote')` by a vendor JWT → error, no change; error bodies contain no SQL/stack text
- [X] T010 [P] [US1] Write race tests in tests/integration/acceptance/accept-race.test.ts (fresh fixture per iteration, 50 iterations each): two concurrent accepts of different quotes on one request (two clients, same household) → exactly one 200 and one 409, exactly one `accepted` quote, exactly one acceptance row, all other submitted quotes `rejected`; two concurrent accepts of the same quote → one 200, one 409; concurrent accept vs vendor `withdraw_quote` on the same quote → exactly one succeeds and the final state is consistent (never accepted AND withdrawn); concurrent accept vs a new `submit_quote` → no `submitted` quote remains on an `accepted` request

### Implementation for User Story 1

- [X] T011 [US1] Add `public.accept_quote(p_quote_id uuid)` to supabase/migrations/20261101000700_quote_acceptances.sql exactly per research.md R-01: household guard (42501); read `request_id` (none → `SM404 QUOTE_NOT_FOUND`); `SELECT … FROM household_requests … FOR UPDATE` first; not owner → `SM404 QUOTE_NOT_FOUND`; accepted/closed or existing acceptance → `SM409 ALREADY_ACCEPTED`; not open/quoted → `SM409 REQUEST_NOT_ACCEPTING`; `SELECT … FROM quotes … FOR UPDATE`, status ≠ submitted → `SM409 QUOTE_NOT_ACCEPTABLE`; update chosen → accepted, others `WHERE status = 'submitted'` → rejected (collect ids), request → accepted, insert `quote_acceptances`; return `(acceptance_id, quote_id, request_id, household_id, accepted_at, rejected_quote_ids)`; `SECURITY DEFINER SET search_path = public, pg_temp`; `REVOKE ALL … FROM public, anon`; `GRANT EXECUTE … TO authenticated`
- [X] T012 [US1] Implement `POST` in src/app/api/quotes/[id]/accept/route.ts: `withApiHandler` → `quoteIdParamSchema` → `parseJsonBody(acceptQuoteBodySchema)` → `requireRole(req, 'household')` → `assertSameOrigin` → `supabase.rpc('accept_quote', { p_quote_id })` with the caller's client → map errors via src/app/api/quotes/_lib/map-acceptance-db-error.ts → `ok(acceptanceResult)`; `logEvent` `quote.accepted`, one `quote.rejected` per rejected id and `request.accepted` (ids/statuses only)
- [X] T013 [P] [US1] Implement `AcceptQuoteDialog` per contracts/ui-acceptance.md §1 in src/components/quotes/accept-quote-dialog.tsx: vendor, price (vendor-confirmed), capacity, estimated net cost with `EstimateBadge`, "The other {n} active quote(s) will be declined.", "This cannot be undone in SolarX."; Cancel default focus; Escape cancels; confirm sends `{confirmed:true}`, shows spinner and is disabled while pending; dialog not dismissible while pending; inline error with Try again
- [X] T014 [P] [US1] Implement `AcceptQuoteButton` (renders only when `canAcceptQuote`; otherwise a status badge using `quoteOutcomeLabel`) in src/components/quotes/accept-quote-button.tsx
- [X] T015 [US1] Fill each `QuoteCard`'s `actionSlot` with `AcceptQuoteButton` in src/components/quotes/quote-comparison-view.tsx (006-owned file): pass request status, quote, active-quote count and net-cost estimate; on success toast "Quote accepted", re-run compare and move focus to the heading; on 409 toast the server message and refresh; read-only when request is accepted/closed — *Done in src/components/quotes/comparison-with-accept.tsx (client wrapper passes `renderAction`; the server page renders it) — verified by tests/e2e/request-quote-compare-accept.spec.ts.*

**Checkpoint**: The P0 flow request → quote → compare → accept works; T008–T010 pass.

---

## Phase 4: User Story 2 - See the accepted request and next steps (Priority: P1)

**Goal**: Household sees chosen vendor, contact, and next steps on the request page and dashboard.

**Independent Test**: After accepting SunRise, request page shows vendor, phone, price, date, five
next steps with portal link and "not guaranteed"; dashboard card shows "Accepted — SunRise Energy".

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] Write tests in tests/integration/acceptance/acceptance-summary.test.ts: owner `GET /api/requests/:id/quotes` returns `acceptance: null` before acceptance; after acceptance returns quoteId, acceptedAt, vendor companyName, isDemo, phone (accepted vendor's only), price, capacityKw; `rpc('household_acceptance_summary')` called by another household or a vendor returns no row — *Done: route assertions added to tests/integration/acceptance/acceptance-summary.test.ts.*

### Implementation for User Story 2

- [X] T017 [US2] Add `public.household_acceptance_summary(p_request_id uuid)` (STABLE SECURITY DEFINER; household guard; returns zero rows unless caller owns the request and an acceptance exists; columns per data-model.md §3) to supabase/migrations/20261101000700_quote_acceptances.sql with the same REVOKE/GRANT
- [X] T018 [US2] Add the additive `acceptance` field (from `household_acceptance_summary`, validated by `acceptanceSummarySchema`) to the owner response in src/app/api/requests/[id]/quotes/route.ts (006-owned; additive only) — *Done in src/app/api/requests/[id]/quotes/route.ts via `household_acceptance_summary`.*
- [X] T019 [P] [US2] Implement `AcceptedNextSteps` per contracts/ui-acceptance.md §2 in src/components/household/accepted-next-steps.tsx: vendor name + Demo badge, `tel:` phone or "Phone not provided", accepted price and capacity, date (`en-IN`), five ordered next steps with https://pmsuryaghar.gov.in/ (`rel="noopener noreferrer"`) and "Subsidy is decided and paid under the official scheme; SolarX does not guarantee it."; loading and error-with-retry states
- [X] T020 [US2] Fill the body of 002's `RequestAcceptanceSlot` to render `AcceptedNextSteps` for `accepted`/`closed` requests (nothing otherwise) in src/components/household/extension-slots.tsx (slot body only)
- [X] T021 [US2] Extend the `card` variant of `RequestQuotesSlot` (006's slot body) to show "Accepted — {vendor company}" and a "View next steps" link for accepted/closed requests in src/components/household/extension-slots.tsx — *Done in src/components/household/quotes-slot-body.tsx (card variant shows "Accepted — vendor" and a next-steps link).*

**Checkpoint**: US1 + US2 deliver the full household journey.

---

## Phase 5: User Story 3 - Vendors see the outcome; only the accepted vendor sees contact (Priority: P2)

**Goal**: Outcome labels in vendor history; contact reveal to the accepted vendor only (D-01).

**Independent Test**: SunRise can view contact; GreenVolt sees "Not selected" and gets 403; before
acceptance SunRise gets 403; households get 403.

### Tests for User Story 3 ⚠️

- [X] T022 [P] [US3] Write tests in tests/integration/acceptance/contact-reveal.test.ts: accepted vendor `GET /api/quotes/:id/contact` → 200 with name, phone, addressText, exact latitude/longitude, locality, acceptedAt and `Cache-Control: no-store`; same vendor before acceptance → 403 `CONTACT_NOT_AVAILABLE` with the exact message; rejected vendor → 403; withdrawn quote's vendor → 403; vendor requesting another vendor's quote id → 404; household → 403; anonymous → 401; non-uuid → 400; direct `rpc('accepted_household_contact')` by a non-accepted vendor raises and returns no data

### Implementation for User Story 3

- [X] T023 [US3] Add `public.accepted_household_contact(p_quote_id uuid)` (STABLE SECURITY DEFINER; vendor guard as 005; quote must belong to caller → else `SM404 QUOTE_NOT_FOUND`; quote `accepted` and acceptance row exists → else `SM403 CONTACT_NOT_AVAILABLE`; returns only the columns in data-model.md §3) to supabase/migrations/20261101000700_quote_acceptances.sql with the same REVOKE/GRANT
- [X] T024 [US3] Implement `GET` in src/app/api/quotes/[id]/contact/route.ts: param schema → `requireRole(req, 'vendor')` → `rpc('accepted_household_contact')` → map errors → `ok(householdContact)` with `Cache-Control: no-store`; `logEvent('contact.revealed', { userId, quoteId, requestId })` only
- [X] T025 [P] [US3] Implement `QuoteOutcomeNotice` (accepted → "Accepted by the household — arrange a site survey"; rejected → "Not selected — the household accepted another quote") in src/components/quotes/quote-outcome-notice.tsx
- [X] T026 [P] [US3] Implement `AcceptedQuoteContact` per contracts/ui-acceptance.md §5 (button → dialog fetching contact on demand; name, `tel:` phone, address, locality, coordinates with an OpenStreetMap link; loading / 403 message / success; no client-side storage) in src/components/quotes/accepted-quote-contact.tsx
- [X] T027 [US3] Render `QuoteOutcomeNotice` for every quote and `AcceptedQuoteContact` for accepted quotes in src/components/quotes/quote-history.tsx (005-owned; additive only)

---

## Phase 6: User Story 4 - Close an accepted request (Priority: P3)

**Goal**: Household manually closes an accepted request (D-10).

**Independent Test**: Close the accepted demo request → "Closed", read-only, still viewable; closing
a quoted or already-closed request → 409.

### Tests for User Story 4 ⚠️

- [X] T028 [P] [US4] Write tests in tests/integration/acceptance/close-request.test.ts: owner closes `accepted` → 200 `closed`; acceptance row and quote statuses unchanged; `open`/`quoted`/`closed` → 409 `REQUEST_NOT_CLOSABLE`; other household → 404; vendor → 403; anonymous → 401; `{}` body → 400; 005's `submit_quote` on the closed request → 409 `REQUEST_NOT_QUOTABLE`

### Implementation for User Story 4

- [X] T029 [US4] Add `public.close_request(p_request_id uuid)` (SECURITY DEFINER; household guard; `FOR UPDATE`; not found/not owner → `SM404 REQUEST_NOT_FOUND`; status ≠ accepted → `SM409 REQUEST_NOT_CLOSABLE`; set `closed`, `updated_at = now()`) to supabase/migrations/20261101000700_quote_acceptances.sql with the same REVOKE/GRANT
- [X] T030 [US4] Implement `POST` in src/app/api/requests/[id]/close/route.ts: param schema → `parseJsonBody(closeRequestBodySchema)` → `requireRole(req, 'household')` → `assertSameOrigin` → `rpc('close_request')` → map errors → `ok({ request })`; `logEvent('request.closed', { userId, requestId, fromStatus: 'accepted', toStatus: 'closed' })`
- [X] T031 [P] [US4] Implement `CloseRequestDialog` per contracts/ui-acceptance.md §3 in src/components/household/close-request-dialog.tsx (confirmation, pending/disabled, `router.refresh()` on success, server message on 409)
- [X] T032 [US4] Add the "Mark as closed" action (only when `canCloseRequest`) and the closed heading to src/components/household/accepted-next-steps.tsx

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Add a small fictional roof image for e2e uploads at tests/fixtures/e2e/roof-sample.jpg (skip if 002 already provides one under tests/fixtures/ and reference that path instead) — *Satisfied by tests/fixtures/roof/clear-roof.jpg from 002 (spec says skip if 002 provides one).*
- [X] T034 Write the P0 end-to-end Playwright test in tests/e2e/request-quote-compare-accept.spec.ts covering plan §18 end-to-end list: household (demo) creates a request with map location (coordinate inputs), roof image, 250 units and ₹1,50,000 budget, and publishes; each of the three demo vendors sees the open request and submits its quote (005 demo values); household sees the quotes and compares all three (scores, missing-item flag on GreenVolt, disclaimer visible); household accepts one quote via the confirmation dialog; request and quote statuses update (accepted / not selected) and next steps appear; a second acceptance attempt (`POST /api/quotes/:id/accept` from the page context) returns 409; the accepted vendor sees "Accepted" and the household contact, a rejected vendor sees "Not selected" — *Done. The request is seeded via the admin client (the wizard is covered by 002's own e2e); vendors submit through the real quote API; everything else goes through the real pages.*
- [X] T035 Review logging in src/app/api/quotes/[id]/accept/route.ts, src/app/api/quotes/[id]/contact/route.ts and src/app/api/requests/[id]/close/route.ts: only allowlisted keys (ids, statuses, reason); no names, phones, addresses or coordinates
- [X] T036 [P] Accessibility and 375 px pass on src/components/quotes/accept-quote-dialog.tsx, src/components/household/accepted-next-steps.tsx and src/components/quotes/accepted-quote-contact.tsx (focus trap/restore, text + icon status, AA contrast) — *Done: axe scan of the accept dialog and the next-steps view, plus a 375 px width check, inside the P0 e2e.*
- [ ] T037 Run lint, type-check, all 007 tests (race test 50/50), the e2e test on a clean `npx supabase db reset`, and the manual walkthrough in specs/007-quote-acceptance/quickstart.md

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T007) → US1 (T008–T015) → US2 (T016–T021) → US3
  (T022–T027) → US4 (T028–T032) → Polish (T033–T037).
- All DB functions are added to the single migration file in order T006 → T011 → T017 → T023 →
  T029 (same file: not parallel).
- US2–US4 depend on US1 (an acceptance must exist). US3 and US4 are independent of each other.
- External: 005 (quotes, `withdraw_quote`, quote history), 006 (comparison view `actionSlot`,
  `GET /api/requests/:id/quotes`), 002 (slots, status module), 003 (net-cost estimate shown in dialog).

## Parallel Example: User Story 1

```bash
Task: "T008 tests/integration/acceptance/accept-cascade.test.ts"
Task: "T009 tests/integration/acceptance/accept-rules.test.ts"
Task: "T010 tests/integration/acceptance/accept-race.test.ts"
# after T011/T012:
Task: "T013 accept-quote-dialog.tsx"  Task: "T014 accept-quote-button.tsx"
```

## Implementation Strategy

1. Foundational + US1 first: this completes the judged P0 flow (≈ 45 min).
2. US2 immediately after (household's next action must be visible).
3. US3 (privacy-correct handover), then US4 if time allows.
4. Run the e2e test (T034) before demo freeze.

## Requirement Coverage

| FR | Tasks |
|---|---|
| FR-001 | T003, T004, T014, T015 |
| FR-002 | T013 |
| FR-003 | T002, T009, T012 |
| FR-004 | T009, T011, T012 |
| FR-005 | T009, T011 |
| FR-006 | T009, T011 |
| FR-007 | T008, T011 |
| FR-008 | T005, T006 |
| FR-009 | T007, T009, T010, T011 |
| FR-010 | T010, T011 |
| FR-011 | T008, T012 |
| FR-012 | T016, T017, T018, T019, T020 |
| FR-013 | T019 |
| FR-014 | T021 |
| FR-015 | T015, T034 |
| FR-016 | T016, T017 |
| FR-017 | T003, T004, T025, T027 |
| FR-018 | T022, T023, T024, T026 |
| FR-019 | T022, T023 |
| FR-020 | T009, T011 |
| FR-021 | T028, T029, T030, T031, T032 |
| FR-022 | T028, T029 |
| FR-023 | T012, T024, T030, T035 |
| FR-024 | T007, T009, T022 |
| FR-025 | T013, T015, T031, T036 |
| FR-026 | T013 |

## Notes

- Always lock the request row before any quote row in DB functions (research R-02).
- Never return or log household contact fields outside `accepted_household_contact`.
