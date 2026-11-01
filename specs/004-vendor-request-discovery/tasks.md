---

description: "Task list for 004-vendor-request-discovery"
---

# Tasks: Vendor Request Discovery

**Input**: Design documents from `/specs/004-vendor-request-discovery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vendor-requests.md, quickstart.md

**Tests**: REQUIRED by constitution VI for domain logic (filters, distance, sort) and for
authorization/privacy (RLS + security-definer functions). Test tasks precede implementation and
must fail first.

**Organization**: Tasks are grouped by user story (spec.md US1–US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single Next.js app at repository root (overview §6): `src/`, `supabase/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm upstream dependencies and prepare the test dataset.

- [ ] T001 Verify 001/002 prerequisites exist (`src/lib/api/respond.ts`, `src/lib/api/errors.ts`, `src/lib/api/auth-guard.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `household_requests` migration, `roof-photos` bucket) and that `leaflet`, `react-leaflet` and `@types/leaflet` are in `package.json` (add them only if 002 has not; name them in plan.md as the only new dependencies)
- [ ] T002 [P] Create the discovery test dataset in `tests/fixtures/discovery-requests.ts`: fictional "Demo" requests in Hyderabad with known statuses (`open`, `quoted`, `draft`, `accepted`, `closed`), exact coordinates with ≥ 4 decimals, localities (one null), monthly units, budgets (₹90,000 / ₹1,00,000 / ₹1,50,000 / ₹2,00,000 / ₹2,50,000), preferred capacities (null, 2, 3, 5, 6 kW) and expected distances from a vendor base at 17.44, 78.38 with a 25 km radius

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB privacy projections and the shared filter/response schema used by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create migration `supabase/migrations/20261101000400_vendor_request_discovery.sql` with: (a) functions `public.vendor_list_open_requests()`, `public.vendor_get_open_request(p_request_id uuid)` and `public.vendor_get_latest_roof_assessment(p_request_id uuid)`, each `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp`, starting with the vendor guard (`raise exception 'FORBIDDEN' using errcode = '42501'` unless `profiles.role = 'vendor'` for `auth.uid()`); (b) list/detail output columns exactly `id, status::text, locality, round(latitude::numeric, 2) as approx_latitude, round(longitude::numeric, 2) as approx_longitude, monthly_units, budget, preferred_capacity_kw, (roof_photo_path is not null) as has_roof_photo, profiles.is_demo, created_at` with `WHERE status IN ('open','quoted')`, ordered `created_at DESC`; (c) roof function guarded by `to_regclass('public.roof_assessments') IS NULL ⇒ RETURN`, returning the newest `status = 'completed'` row's `observations, potential_obstructions, limitations, site_survey_required, created_at AS assessed_at` only when the request is `open`/`quoted`; (d) `REVOKE ALL ... FROM public, anon` and `GRANT EXECUTE ... TO authenticated` on all three; (e) `CREATE INDEX IF NOT EXISTS household_requests_status_idx ON public.household_requests (status)`; (f) NO new RLS policy on `household_requests`, `roof_assessments` or `storage.objects` (comment why, per research R1)
- [ ] T004 [P] Write failing schema tests in `tests/unit/validation/vendor-discovery.test.ts`: `max_distance_km` accepts `0 < x ≤ 500` and `"any"`, rejects 0, -1, 501, "abc"; `locality` trimmed 1–100 chars; capacity `0 ≤ x ≤ 100` and `min ≤ max`; budget integer `0 ≤ x ≤ 10,000,000` and `min ≤ max`; `sort` ∈ `distance|newest`; errors carry the field path
- [ ] T005 Implement `src/lib/validation/vendor-discovery.ts`: `vendorRequestFiltersSchema` (rules in data-model §6), `requestIdParamSchema` (uuid), and types/schemas `VendorRequestSummary`, `VendorRequestDetail`, `VendorDiscoveryContext` exactly as data-model §5 (snake_case fields; `roof_photo_status: 'available' | 'unavailable' | 'none'`) so T004 passes

**Checkpoint**: Migration applies with `supabase db reset`; schema tests pass.

---

## Phase 3: User Story 1 - Browse open requests as a list (Priority: P1) 🎯 MVP

**Goal**: A vendor sees all `open`/`quoted` requests as privacy-safe cards.

**Independent Test**: Seed the T002 dataset, sign in as a demo vendor, `GET /api/requests` returns exactly the `open`/`quoted` rows with no forbidden fields; dashboard renders them.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and ensure they FAIL before implementation.

- [ ] T006 [P] [US1] Privacy integration test (list) in `tests/integration/requests/vendor-discovery-privacy.test.ts`: as a demo vendor, both the `GET /api/requests` response and a direct `rpc('vendor_list_open_requests')` contain no keys `address_text`, `latitude`, `longitude`, `user_id`, `name`, `phone`, `monthly_bill`, `ai_consent`, `roof_photo_path`, and the serialized body contains none of the fixture's exact coordinate strings, address texts, household name or phone; every `approx_latitude`/`approx_longitude` has ≤ 2 decimals and equals the fixture value rounded to 2 dp
- [ ] T007 [P] [US1] Visibility/authorization integration test (list) in `tests/integration/requests/vendor-discovery-visibility.test.ts`: vendor list contains only `open`/`quoted` fixture ids (no `draft`/`accepted`/`closed`); vendor direct `from('household_requests').select('*')` returns `[]`; household calling `rpc('vendor_list_open_requests')` gets error code `42501`; anon client cannot execute the function; household `GET /api/requests` returns only its own requests (002 branch); unauthenticated `GET /api/requests` → `401 UNAUTHENTICATED`
- [ ] T008 [P] [US1] Unit tests in `tests/unit/domain/requests/discovery.test.ts` for `haversineKm` (Hyderabad reference pairs within ±0.5 km; 0 for identical points), `annotateDistance` (integer-km `distance_km`, `within_service_area` inclusive at exactly the radius, both `null` when vendor base missing) and `sortDiscoveryResults` (`distance` ascending with nulls last and ties by newest; `newest` by `created_at` desc; `distance` without base falls back to newest)

### Implementation for User Story 1

- [ ] T009 [US1] Implement pure functions `haversineKm`, `annotateDistance` and `sortDiscoveryResults` in `src/lib/domain/requests/discovery.ts` (no I/O, no framework imports; Earth radius 6371 km; distance from vendor base to the 2-dp approximate location) so T008 passes
- [ ] T010 [US1] Implement `listOpenRequestsForVendor` in `src/app/api/requests/_vendor/list-open-requests.ts`: call `rpc('vendor_list_open_requests')` with the user-scoped server client, read the caller's own `vendors` row for `vendor_context`, annotate distance, sort, cap at 200 with `truncated`, respond `{ data: { items, vendor_context, applied_filters, truncated } }`; map `42501` → `403 FORBIDDEN`, anything else → `500 INTERNAL` with a generic message; log only status/error codes (no ids of households, coordinates or URLs)
- [ ] T011 [US1] Modify `src/app/api/requests/route.ts` (owned by 002): in `GET`, after 001's auth guard, add `if (profile.role === 'vendor') return listOpenRequestsForVendor(request, profile)`; leave the household branch and `POST` unchanged
- [ ] T012 [P] [US1] Create `src/components/vendor/request-card.tsx`: locality (or "Locality not provided"), "≈ N km" (or "Distance unavailable"), monthly units, budget in ₹ Indian grouping, preferred capacity (or "Not specified"), "Has quotes" badge when `status = 'quoted'`, "Demo" badge when `is_demo`, posted date, link to `/vendor/requests/[id]`
- [ ] T013 [US1] Create `src/components/vendor/request-list.tsx`: renders cards, empty state ("No open requests right now — widen filters or check back later"), and a "Showing first 200 — refine filters" notice when `truncated`
- [ ] T014 [US1] Create client container `src/components/vendor/vendor-discovery.tsx`: fetch `GET /api/requests`, loading skeleton, error state with Retry (no stale data shown on error), success → `request-list`
- [ ] T015 [US1] Create `src/app/vendor/dashboard/page.tsx` rendering `vendor-discovery` inside 001's vendor-area guard (unauthenticated → sign-in; household → its own dashboard)

**Checkpoint**: US1 independently functional; T006–T008 pass.

---

## Phase 4: User Story 2 - Review a request's permitted details (Priority: P2)

**Goal**: Privacy-safe detail with short-lived roof photo and latest roof-assessment summary.

**Independent Test**: As a demo vendor open an `open` request with photo (+ completed assessment if 008 present); photo loads, URL expires ≤ 600 s, hidden statuses return identical 404s.

### Tests for User Story 2 ⚠️

- [ ] T016 [P] [US2] Extend `tests/integration/requests/vendor-discovery-privacy.test.ts` with detail cases: `GET /api/requests/:id` and `rpc('vendor_get_open_request')` contain none of the forbidden keys/values from T006; the signed URL path does not appear as a separate field; `roof_assessment` has only `observations, potential_obstructions, limitations, site_survey_required, assessed_at` (no `model`, `prompt_version`)
- [ ] T017 [P] [US2] Extend `tests/integration/requests/vendor-discovery-visibility.test.ts` with detail cases: `draft`, `accepted`, `closed` and a random uuid all return `404 NOT_FOUND` with byte-identical bodies; malformed id → `400 VALIDATION_FAILED`; `roof_photo.expires_at` ≤ now + 600 s; vendor direct `storage.from('roof-photos').download(path)` and `.list()` are denied; with two completed assessments and one failed, only the newest completed is returned; with none (or no `roof_assessments` table) `roof_assessment` is `null`; photo signing failure yields `roof_photo_status: "unavailable"` and still `200`

### Implementation for User Story 2

- [ ] T018 [US2] Implement `getOpenRequestForVendor` in `src/app/api/requests/_vendor/get-open-request.ts`: validate id with `requestIdParamSchema`; `rpc('vendor_get_open_request')` (0 rows → `404 NOT_FOUND` "This request is not available."); then admin-client read of `roof_photo_path` for that id with `status in ('open','quoted')` and `createSignedUrl(path, 600)` on bucket `roof-photos` (failure → `roof_photo_status: 'unavailable'`); `rpc('vendor_get_latest_roof_assessment')`; annotate distance from the caller's `vendors` row; never serialize or log the storage path; map `42501` → `403`
- [ ] T019 [US2] Modify `src/app/api/requests/[id]/route.ts` (owned by 002): in `GET`, after the auth guard, add `if (profile.role === 'vendor') return getOpenRequestForVendor(request, params, profile)`; leave household branch, `PATCH` and other methods unchanged
- [ ] T020 [P] [US2] Create `src/components/vendor/privacy-notice.tsx`: "Exact address and contact details are shared only if the household accepts your quote. Location shown is approximate (≈1 km)."
- [ ] T021 [P] [US2] Create `src/components/vendor/roof-assessment-summary.tsx`: renders observations, potential obstructions, limitations and site-survey reminder as plain text (no HTML injection), labelled "AI-generated visible observations — not a site survey; confidence is not a guarantee", assessed date; "No roof assessment available" when `null`
- [ ] T022 [US2] Create `src/components/vendor/request-detail.tsx`: all summary fields, "Demo" badge, roof photo `<img>` with alt text, "Photo unavailable — retry" (refetch) when `unavailable`, "No roof photo" when `none`, `privacy-notice`, `roof-assessment-summary`; loading, not-found ("This request is no longer available") and error-with-retry states
- [ ] T023 [US2] Create `src/app/vendor/requests/[id]/page.tsx` that fetches `GET /api/requests/:id` via `request-detail` within 001's vendor-area guard, with a back link to `/vendor/dashboard` preserving filters

**Checkpoint**: US1 + US2 work independently; T016–T017 pass.

---

## Phase 5: User Story 3 - Filter requests by distance, capacity and budget (Priority: P3)

**Goal**: Correct, reloadable, validated filters with default service-radius distance.

**Independent Test**: With the T002 dataset each filter and combination returns exactly the expected ids.

### Tests for User Story 3 ⚠️

- [ ] T024 [P] [US3] Extend `tests/unit/domain/requests/discovery.test.ts` with `applyDiscoveryFilters` and `resolveDistanceFilter` cases: inclusive bounds (capacity exactly 3 and 5 included; budget exactly ₹1,00,000 and ₹2,00,000 included); null capacity excluded only when a capacity bound is set; locality case-insensitive contains, null locality never matches; distance ≤ max inclusive; AND combination; `"any"` disables distance; absent `max_distance_km` defaults to `service_radius_km` only when base + radius are known; no base ⇒ distance filter ignored
- [ ] T025 [P] [US3] Filter integration test in `tests/integration/requests/vendor-discovery-filters.test.ts`: against the seeded T002 dataset, each single filter and three combinations return exactly the expected id sets via `GET /api/requests`; default radius applied and echoed in `applied_filters`; `max_distance_km=any` returns all visible; invalid inputs (`min_budget > max_budget`, `max_distance_km=-1`, `min_capacity_kw=abc`) → `400 VALIDATION_FAILED` with `details[].path`; vendor without base location gets `distance_km: null` and no distance filtering

### Implementation for User Story 3

- [ ] T026 [US3] Implement `applyDiscoveryFilters` and `resolveDistanceFilter` in `src/lib/domain/requests/discovery.ts` per data-model §6 so T024 passes
- [ ] T027 [US3] Update `src/app/api/requests/_vendor/list-open-requests.ts` to parse query params with `vendorRequestFiltersSchema` (failure → `400 VALIDATION_FAILED` with `details[{ path, message }]`), apply `resolveDistanceFilter` + `applyDiscoveryFilters` before sort/cap, and return `applied_filters`
- [ ] T028 [P] [US3] Create `src/components/vendor/request-filters.tsx`: labelled inputs for max distance (options 5/10/25/50 km, vendor radius, "Any"), locality, capacity min/max (kW), budget min/max (₹); client-side validation with `vendorRequestFiltersSchema` showing field-level messages; active-filter chips; "Clear filters"; prompt "Set your base location in your vendor profile to filter by distance" when `vendor_context` base is null
- [ ] T029 [US3] Update `src/components/vendor/vendor-discovery.tsx` to sync filters with URL search params (reload keeps filters), pass them to `GET /api/requests`, keep previous results displayed when validation fails, and show the "no matches — clear filters" empty state

**Checkpoint**: US1–US3 work; T024–T025 pass.

---

## Phase 6: User Story 4 - See open requests and my service area on a map (Priority: P4)

**Goal**: Map view (product P1) with markers, vendor base and service-radius circle, same set as list.

**Independent Test**: Switch to Map as a demo vendor with a base; marker count equals list count, circle centred on base, filter change updates both.

### Implementation for User Story 4

- [ ] T030 [P] [US4] Create `src/components/maps/vendor-requests-map.tsx` (client-only; `react-leaflet` `MapContainer` + OSM `TileLayer` with attribution): one `Marker` per item at `approx_latitude/approx_longitude` (offset identical positions slightly), vendor base marker, `Circle` radius `service_radius_km * 1000` m, `Popup` with card summary and "View details" link to `/vendor/requests/[id]`; `tileerror` → callback to parent
- [ ] T031 [US4] Update `src/components/vendor/vendor-discovery.tsx`: keyboard-reachable List/Map toggle (persisted in URL `view` param), load the map with `next/dynamic` `{ ssr: false }`, pass the same filtered `items` to list and map, on tile error show "Map unavailable — switch to list" banner with a button

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Playwright smoke in `tests/e2e/vendor-discovery.spec.ts`: demo vendor signs in → dashboard lists the published demo request → apply capacity filter → toggle Map and assert marker count equals card count → open detail → photo element present, privacy notice visible, page text contains no fixture address text or household name
- [ ] T033 Security review of `src/app/api/requests/_vendor/list-open-requests.ts` and `src/app/api/requests/_vendor/get-open-request.ts`: no personal data, coordinates, signed URLs or storage paths in logs or error messages; admin client used only for the post-authorization photo-path read
- [ ] T034 [P] Accessibility and mobile pass on `src/components/vendor/request-filters.tsx`, `src/components/vendor/request-card.tsx` and `src/components/vendor/request-detail.tsx`: 375 px layout, labels, focus order, WCAG AA contrast using the forest-green/solar-green palette
- [ ] T035 Run the manual walkthrough in `specs/004-vendor-request-discovery/quickstart.md`, then lint, type-check and all 004 tests; record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: requires 001 and 002 implemented.
- **Foundational (Phase 2)**: depends on Setup; T005 depends on T004 (test first). BLOCKS all stories.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on Phase 2; reuses `annotateDistance` from T009 (do US1 first or implement T009 early).
- **US3 (Phase 5)**: depends on US1 (extends the list module and container).
- **US4 (Phase 6)**: depends on US1 (container) and benefits from US3 (shared filters).
- **Polish (Phase 7)**: after desired stories.

### User Story Dependencies

- US1 → none beyond Foundational · US2 → T009 · US3 → US1 · US4 → US1

### Within Each User Story

Tests (fail first) → domain functions → Route Handler module → route switch → components → page.

### Parallel Opportunities

- T002 ∥ T003 ∥ T004
- US1 tests T006 ∥ T007 ∥ T008; T012 ∥ T009
- US2 tests T016 ∥ T017; T020 ∥ T021
- US3 tests T024 ∥ T025; T028 ∥ T026
- T030 can start once T005 types exist
- T032 ∥ T034

---

## Parallel Example: User Story 1

```bash
Task: "Privacy integration test (list) in tests/integration/requests/vendor-discovery-privacy.test.ts"
Task: "Visibility/authorization integration test (list) in tests/integration/requests/vendor-discovery-visibility.test.ts"
Task: "Unit tests for haversineKm/annotateDistance/sortDiscoveryResults in tests/unit/domain/requests/discovery.test.ts"
Task: "Create src/components/vendor/request-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 (migration + schema).
2. Phase 3 (US1) → validate privacy and visibility tests → vendor can see open requests (P0).
3. Add US2 (detail) — required before 005 quote form is useful.

### Incremental Delivery

US1 → US2 → US3 (P0 complete for discovery) → US4 map (P1, only after the P0 flow
request → quote → compare → accept works end to end, constitution I).

### Parallel Team Strategy

Backend: T003, T010–T011, T018–T019, T027. Frontend: T012–T015, T020–T023, T028–T031.
Tests can be written by either in parallel before implementation.

---

## Requirement Coverage

| Requirement | Tasks |
|---|---|
| FR-001 | T003, T007, T010, T011 |
| FR-002 | T003, T009, T012 |
| FR-003 | T008, T009, T010 |
| FR-004 | T010, T013 |
| FR-005 | T003, T006, T016, T018 |
| FR-006 | T003, T006 |
| FR-007 | T003, T007, T017 |
| FR-008 | T020, T022 |
| FR-009 | T018, T019, T022, T023 |
| FR-010 | T017, T018, T022 |
| FR-011 | T003, T016, T017, T021 |
| FR-012 | T017, T018, T022 |
| FR-013 | T017, T018, T022 |
| FR-014 | T024, T025, T026, T027, T028 |
| FR-015 | T024, T025, T026, T027 |
| FR-016 | T024, T026 |
| FR-017 | T004, T005, T025, T027, T028, T029 |
| FR-018 | T028, T029 |
| FR-019 | T030, T031 |
| FR-020 | T031, T032 |
| FR-021 | T030 |
| FR-022 | T031 |
| FR-023 | T007, T011, T015, T019, T023 |
| FR-024 | T010, T011, T018, T019 |
| FR-025 | T010, T018, T025 |
| FR-026 | T013, T014, T022, T023 |
| FR-027 | T028, T031, T034 |
| FR-028 | T012, T022 |
| FR-029 | T010, T018, T033 |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- Do not modify the household branch of `src/app/api/requests/route.ts` or `[id]/route.ts`.
- Never add a vendor RLS policy to `household_requests`; privacy relies on the definer functions.
