# Implementation Plan: Household Solar Request

**Branch**: `002-household-solar-request` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-household-solar-request/spec.md`

## Summary

Deliver the household side of the marketplace's first step: the `household_requests` table with
RLS, guard triggers and the private `roof-photos` bucket; the request status domain module
(`src/lib/domain/requests/`) that 005 and 007 extend; five Route Handlers (`POST/GET
/api/requests`, `GET/PATCH /api/requests/:id`, `POST /api/requests/:id/publish`,
`POST /api/requests/:id/photo`); the four-step wizard (Leaflet/OSM map pin → roof photo with
`ai_consent` → usage and budget → review and publish); the household dashboard and the request
page. The wizard, dashboard and request page expose typed **extension slots** so that 003
(estimate card), 008 (roof analysis panel), 010 (voice button), 006/007 (quotes and acceptance
summaries) and 011 (advisor shortcut) plug in by editing one file, without rewriting 002.

Technical approach: a draft row is created when step 1 is completed and every later step PATCHes
it. Photos are resized in the browser (stays under Vercel's request-body limit), then
re-validated server-side by magic bytes and re-encoded with `sharp`, which strips EXIF (incl. GPS
— essential because vendors will see the photo, D-01) before upload with the caller's RLS-bound
client into `roof-photos/{user_id}/{request_id}/…`. Publishing is a conditional
`UPDATE … WHERE status = 'draft'` after a pure readiness check, so double-publish yields
`409 CONFLICT`. A `BEFORE UPDATE` trigger enforces the canonical status machine and read-only
non-draft rows at the data layer.

## Technical Context

**Language/Version**: TypeScript 5.x strict, Node.js 20+ (Route Handlers on the Node runtime because of `sharp`)

**Primary Dependencies**: From 001: Next.js, React, Tailwind, shadcn/ui, Lucide, `@supabase/ssr`, Zod. **New in 002**: `leaflet`, `react-leaflet`, `@types/leaflet` (dev), `sharp` (server-side image re-encode / metadata strip)

**Storage**: Supabase PostgreSQL (`household_requests` + RLS + guard trigger); Supabase Storage private bucket `roof-photos` (JPEG/PNG/WebP, ≤ 5 MB, signed URLs 600 s)

**Testing**: Vitest unit (domain status/readiness/next-action/wizard steps, validation, photo processing) and integration (API + RLS + storage policies against local Supabase); Playwright e2e (wizard → publish, dashboard)

**Target Platform**: Mobile-first web (≥ 360 px), Vercel + Supabase

**Project Type**: Single Next.js web application (feature slice)

**Performance Goals**: Wizard step save < 1 s on broadband; photo upload of a resized image < 5 s; dashboard first render < 2 s

**Constraints**: Vercel function request body ≤ 4.5 MB (hence client-side resize); OSM tile usage policy (attribution, no bulk use); no AI; exact location never leaves the owner's views

**Scale/Scope**: Demo volumes (tens of requests); 4 wizard steps, 3 pages, 4 Route Handler files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Complete Workflow First | PASS | P0 request creation and publish work with zero AI. AI consent is only stored; extension slots render nothing when 003/008/010 are absent. |
| II. Deterministic Core, Advisory AI | PASS | Status transitions, publish readiness, next action and wizard step selection are pure functions in `src/lib/domain/requests/`, unit-tested. No AI. |
| III. Untrusted Input | PASS | All bodies `.strict()` Zod-validated server-side (`src/lib/validation/requests.ts`); multipart photo validated by size, magic bytes and full decode; filenames from the client are ignored. Voice slot (010) can only *suggest* values that pass the same schema and need user confirmation. |
| IV. Security & Privacy | PASS | `requireRole('household')` + ownership in every handler; RLS on `household_requests` and on `storage.objects` for `roof-photos`; guard trigger blocks status/owner tampering; private bucket, signed URLs 600 s; MIME + 5 MB limits at bucket and server; EXIF/GPS stripped; `ai_consent` default false; logs carry ids/statuses only. No vendor read access granted (004 adds an approximate view). |
| V. Transparent Estimates | PASS (n/a) | No numbers computed here. Estimate slot is owned by 003, which must display assumptions/rule version. |
| VI. Targeted Mandatory Testing | PASS | Unit tests for status machine + readiness (domain logic); integration tests for authorization/RLS on rows and storage objects; e2e for the household part of the P0 flow. Tests precede implementation in tasks.md. |
| VII. Graceful Degradation | PASS | Loading/empty/success/error states per step and page; map-tile failure leaves coordinate inputs usable; upload failure keeps values; slot error boundaries isolate later features. |
| VIII. Simplicity | PASS | No new services. New deps named above: Leaflet (fixed stack), `sharp` (justified in research R-05 — enforces a constitution IV privacy guarantee server-side that would otherwise rely on the browser). |

**Post-design re-check**: PASS. Data model matches overview §7 exactly (no added columns); the
endpoint set equals the 002 rows of overview §8; the only cross-feature touch points are the
documented extension slots and the vendor branch placeholders in the two GET handlers.

## Project Structure

### Documentation (this feature)

```text
specs/002-household-solar-request/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── requests-api.md          # POST/GET /api/requests, GET/PATCH /api/requests/:id, POST …/publish
│   ├── request-photo-api.md     # POST /api/requests/:id/photo
│   └── ui-extension-slots.md    # wizard/dashboard/request page routes + slot props for 003/006/007/008/010/011
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

C = created by 002, M = modified by 002 (file created by 001), later-feature edits noted with →.

```text
package.json                                         M  add leaflet, react-leaflet, sharp, @types/leaflet
supabase/migrations/20261101000200_household_requests.sql  C  table, constraints, indexes, triggers, RLS, roof-photos bucket + storage policies
src/lib/supabase/database.types.ts                   M  regenerate

src/lib/validation/requests.ts                       C  INDIA_BOUNDS, location/usage/draft schemas, create/update/consent schemas, ROOF_PHOTO_* constants
src/lib/domain/requests/status.ts                    C  REQUEST_TRANSITIONS, canTransition, assertTransition, isEditable, isQuotable  (→ 005, 007 use)
src/lib/domain/requests/publish-readiness.ts         C  PUBLISH_REQUIRED_FIELDS, getMissingPublishFields, isReadyToPublish
src/lib/domain/requests/next-action.ts               C  nextActionFor(request)
src/lib/domain/requests/wizard-steps.ts              C  WIZARD_STEPS, firstIncompleteStep, stepForField
src/lib/format.ts                                    C  formatInr (en-IN), formatUnits, formatKw, formatDate

src/lib/requests/repository.ts                       C  server-only: listOwnRequests, getOwnRequest, insertDraft, updateDraft, publishDraft, setRoofPhotoPath
src/lib/requests/dto.ts                              C  server-only: toHouseholdRequestDto (+ signed photo URL, missing fields, next action)
src/lib/requests/photo.ts                            C  server-only: sniffImageType, processRoofPhoto (sharp), storeRoofPhoto, deleteRoofPhoto, signRoofPhotoUrl

src/app/api/requests/route.ts                        C  POST (household), GET (household own; vendor branch → 004)
src/app/api/requests/[id]/route.ts                   C  GET (owner; vendor branch → 004), PATCH (owner)
src/app/api/requests/[id]/publish/route.ts           C  POST (owner)
src/app/api/requests/[id]/photo/route.ts             C  POST multipart (owner), runtime = 'nodejs'

src/app/household/page.tsx                           M  replace 001 placeholder with dashboard
src/app/household/loading.tsx                        C
src/app/household/requests/new/page.tsx              C  wizard, no request yet
src/app/household/requests/[id]/page.tsx             C  draft → wizard at ?step= / first incomplete; else read-only summary
src/app/household/requests/[id]/loading.tsx          C
src/app/household/requests/[id]/not-found.tsx        C

src/components/household/dashboard/request-list.tsx  C
src/components/household/dashboard/request-card.tsx  C
src/components/household/dashboard/next-action-link.tsx C
src/components/household/request-wizard/request-wizard.tsx C  step host, progress, navigation, save calls
src/components/household/request-wizard/wizard-progress.tsx C
src/components/household/request-wizard/location-step.tsx  C
src/components/household/request-wizard/photo-step.tsx     C
src/components/household/request-wizard/usage-step.tsx     C
src/components/household/request-wizard/review-step.tsx    C
src/components/household/request-wizard/publish-dialog.tsx C
src/components/household/request-wizard/use-request-api.ts C  client fetch helpers (create, patch, publish, upload with progress)
src/components/household/request-wizard/resize-image.ts    C  browser canvas resize ≤ 2048 px
src/components/household/request-summary.tsx         C  read-only detail
src/components/household/privacy-notice.tsx          C  "what vendors see / don't see"
src/components/household/extension-slot-types.ts     C  slot prop types (stable contract)
src/components/household/extension-slots.tsx         C  slot components, initially render null  (→ 003, 006, 007, 008, 010, 011 edit)
src/components/shared/slot-boundary.tsx              C  error boundary + Suspense wrapper for slots
src/components/shared/request-status-badge.tsx       C  status → label/colour (reused by 004)
src/components/maps/location-picker.tsx              C  client-only Leaflet picker + lat/lng inputs + "use my location"
src/components/maps/location-picker-lazy.tsx         C  next/dynamic ssr:false wrapper
src/components/maps/static-location-map.tsx          C  read-only pin map (lazy)
src/components/layout/nav-config.ts                  M  add household "New request"

tests/helpers/images.ts                              C  generate JPEG/PNG/WebP buffers (with GPS EXIF), corrupt and oversize payloads
tests/helpers/requests.ts                            C  createDraftViaApi, completeDraft, publishViaApi
tests/unit/domain/requests/status.test.ts            C
tests/unit/domain/requests/publish-readiness.test.ts C
tests/unit/domain/requests/next-action.test.ts       C
tests/unit/domain/requests/wizard-steps.test.ts      C
tests/unit/validation/requests.test.ts               C
tests/unit/requests/photo.test.ts                    C
tests/unit/format.test.ts                            C
tests/integration/requests/requests-api.test.ts      C
tests/integration/requests/publish-api.test.ts       C
tests/integration/requests/photo-api.test.ts         C
tests/integration/requests/list-api.test.ts          C
tests/integration/requests/consent-api.test.ts       C
tests/integration/requests/requests-authz.test.ts    C
tests/integration/requests/requests-rls.test.ts      C
tests/e2e/household-request.spec.ts                  C
tests/e2e/household-dashboard.spec.ts                C
tests/e2e/household-resume.spec.ts                   C
```

**Structure Decision**: Follows overview §6. Pure lifecycle logic in `src/lib/domain/requests/`
(shared with 005/007). Server-only data access for requests lives in a new
`src/lib/requests/` folder so that Route Handlers and the server-rendered request page share one
RLS-bound implementation; UI components never touch Supabase. The `-- 002` seed section adds one
published "Sharma Residence" demo request with a seeded roof photo (T063–T064), because 004, 005,
008 and 009 seed data depend on it. The live demo can still create a second request in the wizard.

## Extension points (for 003, 004, 006, 007, 008, 010, 011)

Full prop contracts: [contracts/ui-extension-slots.md](contracts/ui-extension-slots.md).

| Slot (in `src/components/household/extension-slots.tsx`) | Rendered in | Props (summary) | Owner |
|---|---|---|---|
| `RequestEstimateSlot` | review step, request page, dashboard card (`variant`) | `request: HouseholdRequestDto`, `variant: 'review' \| 'detail' \| 'card'` | 003 |
| `RoofAnalysisSlot` | photo step (under preview), review step, request page | `requestId`, `hasRoofPhoto`, `aiConsent`, `status`, `variant` | 008 |
| `UsageVoiceSlot` | usage step, beside consumption fields | `onSuggest(values: Partial<UsageFields>)`, `disabled` | 010 |
| `RequestQuotesSlot` | request page, dashboard card | `request`, `variant` | 006 |
| `RequestAcceptanceSlot` | request page (top, when `accepted`/`closed`) | `request` | 007 |
| `AdvisorShortcutSlot` | request page, dashboard card | `request` | 011 |

Rules: every slot is wrapped by the host in `SlotBoundary` (error boundary + Suspense) so a
failing slot renders nothing (or a small "unavailable" note) and never breaks the page (FR-020).
`UsageVoiceSlot.onSuggest` only pre-fills the controlled form and highlights the fields as
"Suggested — please check"; values are saved only when the household presses Continue (FR-010).
Slot owners change only the body of their slot component; the host components and prop types
are stable. Prop types live in `extension-slot-types.ts` and reuse `HouseholdRequestDto` and
`UsageFields` from `src/lib/validation/requests.ts`.

Server-side extension points:

- `GET /api/requests` and `GET /api/requests/:id` branch on role; the vendor branch returns
  `FORBIDDEN` "Vendor request discovery is not available yet" until 004 replaces it with an
  approximate-location view (004 must not expose `address_text`, exact coordinates, owner name
  or phone, and should read through a SECURITY DEFINER function or the admin client after its
  own authorization — **no vendor SELECT policy on `household_requests`**).
- `src/lib/domain/requests/status.ts` already encodes the full canonical machine; 005 (open →
  quoted) and 007 (→ accepted, → closed) call `assertTransition` and perform their updates via
  SECURITY DEFINER RPCs (the guard trigger treats those as privileged).
- 008 reads `household_requests.ai_consent` (must be `true`) and `roof_photo_path` server-side;
  it uses `signRoofPhotoUrl()` / storage download from `src/lib/requests/photo.ts`.
- `usageFieldsSchema` is the schema 010 must validate parsed voice output against.
- 003 may recompute its estimate whenever the slot receives changed `monthly_units`, `budget`,
  `monthly_bill` or `preferred_capacity_kw` props.

## Complexity Tracking

Not required — no constitution violations.
