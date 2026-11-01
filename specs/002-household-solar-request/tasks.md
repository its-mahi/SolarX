---
description: "Task list for 002 Household Solar Request"
---

# Tasks: Household Solar Request

**Input**: Design documents from `/specs/002-household-solar-request/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md;
feature 001 Phase 1–2 complete (app scaffold, `src/lib/api/*`, `src/lib/validation/enums.ts`,
`src/lib/validation/common.ts`, Supabase clients, shared state components, `tests/helpers/*`).
**Do not re-scaffold anything owned by 001.**

**Tests**: REQUIRED (constitution VI) for the request status machine and publish readiness
(domain logic), authorization/RLS on rows and storage objects, and the household part of the
end-to-end flow. Each test task precedes the implementation it covers and must fail first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

- [X] T001 Add runtime dependencies `leaflet`, `react-leaflet`, `sharp` and dev dependency `@types/leaflet` to package.json (no other new packages)
- [X] T002 [P] Create tests/helpers/images.ts generating test images with `sharp`: 1200×800 JPEG/PNG/WebP "roof" buffers, a JPEG carrying GPS EXIF (`withExif` with `GPSLatitude`/`GPSLongitude` and `Make`/`Model`), a 6 MB payload, a text file named `.jpg`, a truncated JPEG, and `writeTempImage()` for Playwright file choosers
- [X] T003 [P] Unit test tests/unit/format.test.ts: `formatInr(150000)` → "₹1,50,000", `formatInr(0)` → "₹0", `formatUnits(250)` → "250 units (kWh)", `formatKw(3)` → "3.0 kW", `formatKw(null)` → "—"
- [X] T004 [P] Implement src/lib/format.ts (`formatInr` via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`, `formatUnits`, `formatKw`, `formatDate`) so T003 passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, storage, domain lifecycle, validation, server data access and the slot
contract that every story (and features 003–011) relies on.

### Tests for Foundational (write first)

- [X] T005 [P] Unit test tests/unit/domain/requests/status.test.ts: for all 25 (from, to) pairs of `draft|open|quoted|accepted|closed`, `canTransition` is true exactly for `draft→open`, `open→quoted`, `open→accepted`, `quoted→accepted`, `accepted→closed`; `assertTransition` throws on others; `isEditable` true only for `draft`; `isQuotable` true only for `open`, `quoted`
- [X] T006 [P] Unit test tests/unit/domain/requests/publish-readiness.test.ts: complete request → `[]`; each of latitude/longitude missing → `location`; missing `address_text`, `locality`, `monthly_units`, `budget`, `roof_photo_path` → that field (`roof_photo`); empty draft → all six in order `location, address_text, locality, monthly_units, budget, roof_photo`; optional `monthly_bill`/`preferred_capacity_kw` never reported
- [X] T007 [P] Unit test tests/unit/domain/requests/wizard-steps.test.ts and tests/unit/domain/requests/next-action.test.ts: `firstIncompleteStep` (empty → `location`; location done → `photo`; photo done → `usage`; all done → `review`); `stepForField` mapping; `nextActionFor` returns `continue`+step for draft, `wait` for open, `compare` for quoted, `next_steps` for accepted, `view` for closed, with labels from data-model.md
- [X] T008 [P] Unit test tests/unit/validation/requests.test.ts: latitude 6.5–37.5 and longitude 68–97.5 boundaries (6.49 / 37.51 / 67.99 / 97.51 rejected with "SolarX currently supports locations in India"), lat without lng rejected; `address_text` 5–300 trimmed; `locality` 2–100; `monthly_units` integer 1–10000 (0, 10001, 2.5 rejected); `monthly_bill` 0–100000 or null; `budget` 10000–5000000; `preferred_capacity_kw` 0.5–20 multiple of 0.1 (0.4, 20.1, 3.25 rejected); unknown keys `status`, `user_id`, `roof_photo_path`, `id` rejected; `updateDraftSchema` rejects `{}`; `consentWithdrawalSchema` accepts only `{ ai_consent: false }`

### Implementation for Foundational

- [X] T009 [P] Implement src/lib/validation/requests.ts: `INDIA_BOUNDS`, `locationFieldsSchema`, `usageFieldsSchema`, `draftFieldsSchema` (all optional + nullable, `.strict()`), `createRequestSchema`, `updateDraftSchema` (≥ 1 key), `consentWithdrawalSchema`, `ROOF_PHOTO_MAX_BYTES = 5 * 1024 * 1024`, `ROOF_PHOTO_MIME_TYPES = ['image/jpeg','image/png','image/webp']`, `ROOF_PHOTO_MAX_DIMENSION = 2048`, exported types `UsageFields`, `DraftFields`; reuse `latitudeSchema`/`inrAmountSchema`/`trimmedText` from src/lib/validation/common.ts so T008 passes
- [X] T010 [P] Implement src/lib/domain/requests/status.ts (`REQUEST_TRANSITIONS`, `canTransition`, `assertTransition`, `isEditable`, `isQuotable`; imports `RequestStatus` from src/lib/validation/enums.ts; no I/O) so T005 passes
- [X] T011 [P] Implement src/lib/domain/requests/publish-readiness.ts (`PUBLISH_REQUIRED_FIELDS`, `getMissingPublishFields`, `isReadyToPublish`) so T006 passes
- [X] T012 [P] Implement src/lib/domain/requests/wizard-steps.ts (`WIZARD_STEPS = ['location','photo','usage','review']`, `firstIncompleteStep`, `stepForField`) and src/lib/domain/requests/next-action.ts (`nextActionFor` → `{ kind, label, step? }`) so T007 passes
- [X] T013 Write supabase/migrations/20261101000200_household_requests.sql part 1: table `household_requests` with columns, types and CHECKs exactly as data-model.md (`address_text` 5–300, `locality` 2–100, `monthly_units` 1–10000, `monthly_bill` 0–100000, `budget` 10000–5000000, `preferred_capacity_kw numeric(4,1)` 0.5–20, `roof_photo_path LIKE user_id || '/' || id || '/%'`, `ai_consent boolean NOT NULL DEFAULT false`, `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','quoted','accepted','closed'))`), `household_requests_location_pair_chk`, `household_requests_publish_complete_chk`, indexes `(user_id, created_at DESC)` and `(status)`, and the `set_updated_at` trigger
- [X] T014 Add guard triggers to supabase/migrations/20261101000200_household_requests.sql: `household_requests_guard_insert()` (non-privileged: `status = 'draft'`, `roof_photo_path IS NULL`, `user_id = auth.uid()`, `current_user_role() = 'household'`) and `household_requests_guard_update()` (immutable `id`/`user_id`/`created_at`; status changes only `draft→open`, `open→quoted`, `open→accepted`, `quoted→accepted`, `accepted→closed`; non-privileged: from draft only `→ open`, non-draft rows only `ai_consent true→false`)
- [X] T015 Add RLS to supabase/migrations/20261101000200_household_requests.sql: enable RLS; `household_requests_select_own` (SELECT `user_id = auth.uid()`), `household_requests_insert_own` (WITH CHECK `user_id = auth.uid() AND public.current_user_role() = 'household' AND status = 'draft' AND roof_photo_path IS NULL`), `household_requests_update_own` (USING/WITH CHECK `user_id = auth.uid()`); no DELETE policy; no vendor policy
- [X] T016 Add the private bucket and storage policies to supabase/migrations/20261101000200_household_requests.sql: `storage.buckets` row `roof-photos` (`public = false`, `file_size_limit = 5242880`, `allowed_mime_types = {image/jpeg,image/png,image/webp}`, `ON CONFLICT DO NOTHING`); policies `roof_photos_owner_select` (folder 1 = `auth.uid()`), `roof_photos_owner_insert_draft` and `roof_photos_owner_delete_draft` (folder 1 = `auth.uid()` AND folder 2 is a `draft` request of `auth.uid()`); no UPDATE policy
- [X] T017 Run `npm run db:reset` and regenerate src/lib/supabase/database.types.ts
- [X] T018 Implement src/lib/requests/repository.ts (`import "server-only"`; RLS-bound client passed in): `listOwnRequests`, `getOwnRequest` (null when hidden), `insertDraft`, `updateDraft`, `publishDraft` (conditional `UPDATE … SET status = 'open' WHERE id = $1 AND status = 'draft'` returning row or null), `setRoofPhotoPath` (conditional on `status = 'draft'`); map trigger/check violations to `ApiError('CONFLICT')` without echoing database text
- [X] T019 Implement src/lib/requests/dto.ts `toHouseholdRequestDto(row, { signedUrl? })` producing exactly the fields in contracts/requests-api.md (`has_roof_photo`, `missing_publish_fields`, `next_action`; never `roof_photo_path`)
- [X] T020 [P] Create src/components/shared/request-status-badge.tsx (labels/styles per contracts/ui-extension-slots.md) and src/components/shared/slot-boundary.tsx (client error boundary + `Suspense`; failure renders nothing)
- [X] T021 [P] Create src/components/household/extension-slot-types.ts (prop types for `RequestEstimateSlot`, `RoofAnalysisSlot`, `UsageVoiceSlot`, `RequestQuotesSlot`, `RequestAcceptanceSlot`, `AdvisorShortcutSlot` exactly as contracts/ui-extension-slots.md) and src/components/household/extension-slots.tsx (each slot returns `null`, with a header comment naming the owning feature)
- [X] T022 [P] Create tests/helpers/requests.ts (`createDraftViaApi(token, fields)`, `uploadPhotoViaApi(token, id, buffer)`, `completeDraft(token)` → fully filled draft with photo, `publishViaApi(token, id)`) using tests/helpers/api.ts from 001

**Checkpoint**: Migration applies, domain/validation unit tests pass, slots exist.

---

## Phase 3: User Story 1 - Create and publish a solar request (Priority: P1) 🎯 MVP

**Goal**: Four-step wizard that saves a draft and publishes it (draft → open).

**Independent Test**: Demo household completes the wizard with a photo, publishes, sees status "Open" and no edit controls.

### Tests for User Story 1 (write first)

- [X] T023 [P] [US1] Unit test tests/unit/requests/photo.test.ts: `sniffImageType` recognises JPEG/PNG/WebP magic bytes and rejects text/GIF/PDF; `processRoofPhoto` output has no EXIF (`sharp(out).metadata().exif` undefined, no GPS), longest side ≤ 2048, keeps format; truncated JPEG → `ApiError('VALIDATION_FAILED')`
- [X] T024 [P] [US1] Integration test tests/integration/requests/requests-api.test.ts: household `POST /api/requests` with location → 201 draft with `missing_publish_fields` and `next_action.step = 'photo'`; `PATCH` usage fields → 200; `PATCH` with `null` clears `monthly_bill`; `GET /api/requests/:id` returns `roof_photo_url` only after a photo exists and it expires in ≤ 600 s; body with `status` → 400
- [X] T025 [P] [US1] Integration test tests/integration/requests/photo-api.test.ts: JPEG, PNG, WebP uploads → 200 `has_roof_photo`; stored object (downloaded via admin client) has no GPS/Make/Model EXIF; second upload replaces and the first object no longer exists; 6 MB → 413 `PAYLOAD_TOO_LARGE`; text-as-jpg → 400; truncated JPEG → 400; missing `file` → 400; upload to a published request → 409
- [X] T026 [P] [US1] Integration test tests/integration/requests/publish-api.test.ts: incomplete draft → 400 with one `details` entry per missing item; complete draft → 200 `status: 'open'`, `next_action.kind: 'wait'`; second publish → 409; two concurrent publishes → exactly one 200 and one 409; `PATCH` usage on the open request → 409 "This request has been published and can no longer be edited"
- [X] T027 [P] [US1] E2E test tests/e2e/household-request.spec.ts: demo household → New request → place pin by keyboard coordinates, address, locality → upload generated JPEG (tests/helpers/images.ts) → tick consent → 250 units, ₹1,50,000, 3 kW → review shows values and privacy notice → Publish → confirm → request page shows "Open — awaiting quotes" and no edit controls

### Implementation for User Story 1

- [X] T028 [US1] Implement src/lib/requests/photo.ts (`import "server-only"`): `sniffImageType`, `processRoofPhoto` (`sharp(buf, { failOn: 'error' }).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })`, re-encode to sniffed format, no `withMetadata`), `storeRoofPhoto(client, userId, requestId, processed)` → key `{user_id}/{request_id}/{uuid}.{ext}`, `deleteRoofPhoto`, `signRoofPhotoUrl(client, key)` with 600 s expiry, so T023 passes
- [X] T029 [US1] Implement `POST` in src/app/api/requests/route.ts: `withApiHandler`, `requireRole('household')`, `assertSameOrigin`, `parseJsonBody(createRequestSchema)`, `insertDraft`, 201 DTO, `logEvent('request.created', { requestId, userId })`
- [X] T030 [US1] Implement `GET` and `PATCH` (draft path) in src/app/api/requests/[id]/route.ts: UUID param check; `GET` — vendor → `FORBIDDEN` "Vendor request discovery is not available yet" (placeholder for 004), household → `getOwnRequest` or `NOT_FOUND`, DTO with signed URL; `PATCH` — owner + draft → `updateDraftSchema` → `updateDraft`; non-draft → `CONFLICT` "This request has been published and can no longer be edited"
- [X] T031 [US1] Implement `POST` in src/app/api/requests/[id]/publish/route.ts: owner check (`NOT_FOUND`), `assertTransition('draft','open')` else `CONFLICT` "This request is already published", `getMissingPublishFields` → `VALIDATION_FAILED` "Complete the missing items before publishing." with per-field `details`, `publishDraft` (null → `CONFLICT`), `logEvent('request.published', { requestId, fromStatus: 'draft', toStatus: 'open' })`
- [X] T032 [US1] Implement `POST` in src/app/api/requests/[id]/photo/route.ts (`export const runtime = 'nodejs'`) following the 9-step order in contracts/request-photo-api.md (size check > 5,242,880 bytes → `PAYLOAD_TOO_LARGE`; sniff; process; store; conditional `setRoofPhotoPath`, delete new object on failure; best-effort delete old; `logEvent('request.photo_uploaded', { requestId })`) so T025 passes
- [X] T033 [P] [US1] Create src/components/maps/location-picker.tsx (client; `react-leaflet` MapContainer, OSM tiles with "© OpenStreetMap contributors" attribution, Lucide `MapPin` `divIcon`, click/drag to set pin, latitude/longitude inputs with 6 decimals, "Use my location" with 10 s timeout and permission-denied message, tile-error notice keeping inputs usable; imports `leaflet/dist/leaflet.css`), src/components/maps/location-picker-lazy.tsx (`next/dynamic`, `ssr: false`, LoadingState) and src/components/maps/static-location-map.tsx (non-interactive pin, lazy)
- [X] T034 [P] [US1] Create src/components/household/request-wizard/resize-image.ts (reject > 5 MB or non JPEG/PNG/WebP before processing; canvas resize to ≤ 2048 px; JPEG quality 0.85; fall back to original on decode failure) and src/components/household/request-wizard/use-request-api.ts (`createRequest`, `patchRequest`, `publishRequest`, `uploadPhoto` via XHR with progress; parses the error envelope into field errors)
- [X] T035 [US1] Create src/components/household/request-wizard/wizard-progress.tsx (4 labelled steps, current step `aria-current="step"`) and src/components/household/request-wizard/request-wizard.tsx (holds request DTO + current step, renders steps, Back/Continue with pending state, maps server `details` to fields, on `409` redirects to the read-only page with the "no longer editable" message)
- [X] T036 [P] [US1] Create src/components/household/request-wizard/location-step.tsx (LocationPickerLazy + address + locality, client `locationFieldsSchema` validation; Continue → create or patch)
- [X] T037 [P] [US1] Create src/components/household/request-wizard/photo-step.tsx (file input `accept="image/jpeg,image/png,image/webp"` `capture="environment"`, resize → upload with progress, preview from signed URL, replace, specific error messages; AI-consent checkbox unticked by default with the copy from contracts/ui-extension-slots.md saved via PATCH; `RoofAnalysisSlot variant="photo-step"` inside `SlotBoundary`)
- [X] T038 [P] [US1] Create src/components/household/request-wizard/usage-step.tsx (labelled inputs: monthly units (kWh) required, monthly bill ₹ optional, budget ₹ required, preferred capacity kW optional; inline `usageFieldsSchema` errors; `UsageVoiceSlot` in `SlotBoundary` whose `onSuggest` fills fields and marks them "Suggested — please check" without saving; Continue → PATCH)
- [X] T039 [P] [US1] Create src/components/household/privacy-notice.tsx (vendor-sees / vendor-does-not-see copy) and src/components/household/request-wizard/publish-dialog.tsx (shadcn Dialog with privacy notice, Cancel / "Publish request", pending and error states)
- [X] T040 [US1] Create src/components/household/request-wizard/review-step.tsx (grouped values with `formatInr`/`formatUnits`/`formatKw`, Edit links per group, photo preview, consent state, missing-items list linking to `stepForField`, PrivacyNotice, `RequestEstimateSlot variant="review"` and `RoofAnalysisSlot variant="review"` in SlotBoundary, Publish disabled while items are missing, PublishDialog → publish → `router.replace` + toast "Your request is live. Vendors can now send quotes.")
- [X] T041 [US1] Create src/components/household/request-summary.tsx (status badge, StaticLocationMap + address + locality, usage and budget, photo, consent state, and slots `RequestAcceptanceSlot`, `RequestQuotesSlot(detail)`, `RequestEstimateSlot(detail)`, `RoofAnalysisSlot(detail)`, `AdvisorShortcutSlot(detail)` each in SlotBoundary)
- [X] T042 [US1] Create src/app/household/requests/new/page.tsx (RequestWizard with no request), src/app/household/requests/[id]/page.tsx (server: `getOwnRequest` via RLS-bound client → `notFound()`; draft → RequestWizard at valid `?step=` or `firstIncompleteStep`; else RequestSummary), src/app/household/requests/[id]/loading.tsx and src/app/household/requests/[id]/not-found.tsx
- [X] T043 [US1] Add household nav item "New request" (`/household/requests/new`, Lucide `PlusCircle`) to src/components/layout/nav-config.ts

**Checkpoint**: A household can create and publish a request; T023–T027 pass.

---

## Phase 4: User Story 2 - Only I can see and change my request (Priority: P1)

**Goal**: Prove and harden owner-only access at server, row and storage levels; no exact location leakage.

**Independent Test**: Run the authorization matrix and RLS/storage suites — every non-owner attempt is refused.

### Tests for User Story 2 (write first)

- [X] T044 [P] [US2] Integration test tests/integration/requests/requests-authz.test.ts: for household A's draft and A's published request, as household B → `GET /:id`, `PATCH`, `publish`, `photo` all 404 and A's row unchanged; as demo vendor → `POST /api/requests` 403 and `PATCH`/`publish`/`photo` 403; anonymous → 401 for all six operations; B's `GET /api/requests` never contains A's ids; cookie-authenticated POST with foreign `Origin` → 403; non-UUID id → 400
- [X] T045 [P] [US2] Integration test tests/integration/requests/requests-rls.test.ts using direct Supabase clients: B `select` A's rows → 0; B `update` A's row → 0 affected; A `insert` with `status = 'open'` or a `roof_photo_path` → denied; vendor `insert` → denied; A update `status` to `quoted` or back to `draft` → error; A update `user_id` → error; A set `roof_photo_path` outside `{A}/{request}/` → check violation; A change `monthly_units` on an open request → error; A `ai_consent` true→false on open → ok, false→true → error; storage: B download/sign A's object → denied, B upload into `A/…` → denied, A upload into a published request folder → denied, anonymous download → denied

### Implementation for User Story 2

- [X] T046 [US2] Set `Cache-Control: no-store` on every response from src/app/api/requests/route.ts, src/app/api/requests/[id]/route.ts, src/app/api/requests/[id]/publish/route.ts and src/app/api/requests/[id]/photo/route.ts (passing `{ headers }` through the `ResponseInit` argument of `ok`/`created` from 001) so owner data and signed URLs are never cached
- [X] T047 [US2] Review src/lib/requests/repository.ts, src/lib/requests/photo.ts and the four route files so that every error path returns `NOT_FOUND`/`CONFLICT`/`INTERNAL` without database text, and every `logEvent` call carries only `requestId`, `userId`, `fromStatus`, `toStatus`, `reason` (no address, coordinates, file names or paths); fix any gap found by T044/T045

**Checkpoint**: Authorization suites T044–T045 pass.

---

## Phase 5: User Story 3 - See my requests and what to do next (Priority: P2)

**Goal**: Household dashboard listing own requests with status, key figures, next action and slots.

**Independent Test**: With draft/open/quoted/accepted/closed requests, each card shows the right label; with none, the empty state appears.

### Tests for User Story 3 (write first)

- [X] T048 [P] [US3] Integration test tests/integration/requests/list-api.test.ts: household `GET /api/requests` → own items newest first with `roof_photo_url: null` and correct `next_action` for each status (non-draft statuses set via the admin client); no requests → `items: []`; vendor → 403 placeholder until 004
- [X] T049 [P] [US3] E2E test tests/e2e/household-dashboard.spec.ts: new household sees empty state "Create your solar request"; after creating a draft and a published request, cards show status badge, locality, units, ₹ budget, kW, created date and "Continue request" / "Waiting for vendor quotes"; statuses `quoted`, `accepted`, `closed` set via admin client show "Compare quotes", "View next steps", "View request"; failing API (route intercepted) shows error state with retry

### Implementation for User Story 3

- [X] T050 [US3] Implement `GET` in src/app/api/requests/route.ts: household → `listOwnRequests` ordered `created_at DESC` → `{ items: HouseholdRequestDto[] }` (no signed URLs); vendor → `FORBIDDEN` "Vendor request discovery is not available yet" (004 replaces this branch)
- [X] T051 [P] [US3] Create src/components/household/dashboard/next-action-link.tsx (maps `next_action.kind`/`step` to href per data-model.md; `wait` rendered as status text with a "View request" link)
- [X] T052 [US3] Create src/components/household/dashboard/request-card.tsx (RequestStatusBadge, locality, `formatUnits`, `formatInr`, `formatKw`, `formatDate`, NextActionLink, slots `RequestEstimateSlot(card)`, `RequestQuotesSlot(card)`, `AdvisorShortcutSlot(card)` in SlotBoundary) and src/components/household/dashboard/request-list.tsx (EmptyState with "Create your solar request" action when empty)
- [X] T053 [US3] Replace the 001 placeholder in src/app/household/page.tsx with the dashboard (server-rendered `listOwnRequests` via the RLS-bound client, heading, always-visible "New request" button, RequestList, ErrorState with retry on failure) and add src/app/household/loading.tsx (card skeletons)

**Checkpoint**: Dashboard independently functional; T048–T049 pass.

---

## Phase 6: User Story 4 - Resume a draft and manage AI consent (Priority: P3)

**Goal**: Resume drafts at the right step with values restored; give/remove consent on drafts; withdraw after publishing.

**Independent Test**: Stop after step 2, return later and finish; withdraw consent on a published request; re-granting is refused.

### Tests for User Story 4 (write first)

- [X] T054 [P] [US4] Integration test tests/integration/requests/consent-api.test.ts: draft `PATCH { ai_consent: true }` then `false` → 200 each; open request `PATCH { ai_consent: false }` → 200 and persisted; open request `PATCH { ai_consent: true }` → 409 "Consent can only be given before publishing"; open request `PATCH { ai_consent: false, budget: 1 }` → 409; consent change emits no personal data in logs
- [X] T055 [P] [US4] E2E test tests/e2e/household-resume.spec.ts: complete steps 1–2, open a new browser context, sign in as the same household, "Continue request" opens step 3 with step-1 values and photo preview restored; edit address via the review Edit link and see it updated; on a published request with consent, withdraw consent and see "AI analysis consent withdrawn"

### Implementation for User Story 4

- [X] T056 [US4] Extend `PATCH` in src/app/api/requests/[id]/route.ts with the non-draft branch: accept only `consentWithdrawalSchema`; `ai_consent: true` → `CONFLICT` "Consent can only be given before publishing"; anything else → `CONFLICT` "This request has been published and can no longer be edited"; `logEvent('request.ai_consent_changed', { requestId, reason })` for every consent change (draft or not)
- [X] T057 [US4] Make src/components/household/request-wizard/request-wizard.tsx restore state from the server DTO (values, photo preview via `roof_photo_url`, consent), honour a valid `?step=` and otherwise open `firstIncompleteStep`, and keep the URL `?step=` in sync on navigation
- [X] T058 [US4] Add a consent control to src/components/household/request-summary.tsx: when `ai_consent` is true and status is not `draft`, show "Withdraw AI analysis consent" with confirmation → `PATCH { ai_consent: false }` → state "AI analysis consent withdrawn"; when false and not draft, show explanatory text only

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T059 [P] Accessibility pass over src/components/household/request-wizard/*.tsx and src/components/maps/location-picker.tsx: visible labels, `aria-describedby` errors, focus to first invalid field and to the step heading on step change, map container `aria-label`, progress announced
- [X] T060 [P] Add 360 px assertions (no horizontal scroll; Publish/Continue visible) and an `@axe-core/playwright` scan of each wizard step and the dashboard to tests/e2e/household-request.spec.ts and tests/e2e/household-dashboard.spec.ts
- [ ] T061 Run every step of specs/002-household-solar-request/quickstart.md and fix gaps
- [X] T062 Using the scripts in package.json, run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` and record results
- [X] T063 Append section "-- 002 demo request" to supabase/seed.sql: one published (`status = 'open'`) "Sharma Residence" request owned by the 001 demo household (fixed UUID; Hyderabad, Telangana; `monthly_units = 250`; `budget = 150000`; `preferred_capacity_kw = 3`; `ai_consent = true`; `roof_photo_path = '{household_uuid}/{request_uuid}/clear-roof.jpg'` in bucket `roof-photos`), labelled Demo. This is the request that 004 lists, 005 T035 quotes on, 008 T050 assesses and 009 T025 injects (validation-report fix V-02)
- [X] T064 Create scripts/seed-demo-storage.ts and an `npm run seed:storage` script in package.json that, after `supabase db reset`, uploads tests/fixtures/roof/clear-roof.jpg to the private `roof-photos` bucket at the T063 path with the service-role client (idempotent; server-side only). If 008 T003 has not landed yet, add that fixture first with the same constraints (fictional, no people, faces, house numbers or location text)

---

## Dependencies & Execution Order

### Phase Dependencies

- 001 Phase 1–2 must be complete before T001.
- Setup (T001–T004) → Foundational (T005–T022) → US1 → US2 → US3/US4 → Polish.
- Migration tasks T013 → T014 → T015 → T016 (same file) → T017 → T018 → T019.

### User Story Dependencies

- **US1 (P1)**: after Foundational.
- **US2 (P1)**: tests can be written after Foundational; they exercise the US1 routes (T029–T032), so they go green once US1 is implemented.
- **US3 (P2)**: after Foundational; T050 edits src/app/api/requests/route.ts after T029.
- **US4 (P3)**: after US1 (extends T030 route and T035 wizard, T041 summary).

### Within Each User Story

Tests first (failing) → server modules → routes → UI components → pages.

### Parallel Opportunities

- T002–T004 in parallel; T005–T012 in parallel; T020–T022 in parallel.
- US1: T023–T027 in parallel; then T033, T034, T036–T039 in parallel once T035's props are agreed.
- US2: T044, T045 in parallel.
- US3: T048, T049, T051 in parallel.
- US4: T054, T055 in parallel.

## Parallel Example: User Story 1

```bash
Task: "Unit test photo processing in tests/unit/requests/photo.test.ts"
Task: "Integration test requests API in tests/integration/requests/requests-api.test.ts"
Task: "Integration test photo API in tests/integration/requests/photo-api.test.ts"
Task: "Integration test publish API in tests/integration/requests/publish-api.test.ts"
Task: "E2E wizard in tests/e2e/household-request.spec.ts"
```

## Implementation Strategy

### MVP First

1. Setup + Foundational (schema, domain, slots).
2. US1 → validate with T023–T027 → vendor discovery (004) can start against real open requests.
3. US2 authorization suites green (required before demo).
4. US3 dashboard, then US4 resume/consent.

### Parallel Team Strategy

- Backend: T013–T019, T028–T032, US2.
- Frontend: T020–T021, T033–T043, then US3 UI.
- Tests: T005–T008, T022–T027 alongside.

## Requirement Coverage

| Requirement | Tasks |
|---|---|
| FR-001 Four-step wizard, progress, back | T012, T035, T042, T043, T027 |
| FR-002 Map pin + accessible alternatives + address/locality + India only | T009, T033, T036, T008, T027, T059 |
| FR-003 Draft saved after step 1, every step saves | T029, T030, T034, T035, T036, T024 |
| FR-004 One photo, types, ≤ 5 MB, preview, replace, rejections | T009, T028, T032, T034, T037, T023, T025 |
| FR-005 Private storage, signed links ≤ 10 min | T016, T028, T030, T024, T045, T046 |
| FR-006 Metadata stripped, size reduced | T028, T034, T023, T025 |
| FR-007 Optional unticked consent stored, no AI | T013, T037, T024 |
| FR-008 Consent change in draft; withdrawal only after publish | T014, T056, T058, T054, T045 |
| FR-009 Usage & budget fields and ranges | T009, T013, T038, T008 |
| FR-010 Voice slot suggests, user confirms | T021, T038 |
| FR-011 Review step summary + privacy notice | T039, T040, T027 |
| FR-012 Publish requires complete data; missing list | T011, T013, T031, T040, T006, T026 |
| FR-013 Explicit confirmation; open; locked | T031, T039, T040, T041, T026, T027 |
| FR-014 Only drafts publish; repeat/concurrent/edits refused | T018, T030, T031, T032, T026 |
| FR-015 Canonical statuses; only draft→open here; data-layer enforcement | T010, T014, T005, T045 |
| FR-016 Dashboard list, newest first, fields, New request | T050, T052, T053, T048, T049 |
| FR-017 Empty state | T052, T053, T049 |
| FR-018 Next action by status | T012, T019, T051, T007, T048, T049 |
| FR-019 Request page: wizard for drafts, summary otherwise | T041, T042, T057 |
| FR-020 Reserved slots that never break the page | T020, T021, T037, T038, T040, T041, T052 |
| FR-021 Household-only create; owner-only operations; 404/401/403 | T029, T030, T031, T032, T050, T044 |
| FR-022 Enforcement at data and file-storage layers | T014, T015, T016, T045 |
| FR-023 Server validation; status/owner/photo ref not settable | T009, T018, T008, T024, T045 |
| FR-024 No exact location to non-owners | T015, T030, T050, T044, T047 |
| FR-025 Loading/empty/success/error; upload progress; retry keeps values | T034, T035, T042, T053, T049 |
| FR-026 Labels, keyboard, ₹ grouping, kWh | T003, T004, T038, T040, T059, T060 |
| FR-027 Status-change logging without personal data | T029, T031, T032, T047, T056 |
