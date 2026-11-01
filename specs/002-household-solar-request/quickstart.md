# Quickstart: Household Solar Request

Validation guide for feature 002. Contracts: [contracts/](contracts/). Data model:
[data-model.md](data-model.md).

## Prerequisites

- Feature 001 complete (app, auth, demo accounts, test helpers).
- Local Supabase running (`supabase start`), env as in `specs/001-platform-foundation-auth/quickstart.md`.
- `npm install` (adds `leaflet`, `react-leaflet`, `sharp`).
- A roof/terrace photo on your machine (any JPEG/PNG/WebP ≤ 5 MB); ideally one phone photo with
  location metadata enabled.

## Run

```bash
npm run db:reset     # applies 20261101000200_household_requests.sql (table, RLS, roof-photos bucket)
npm run dev          # http://localhost:3000
```

## Manual acceptance walkthrough

| # | Steps | Expected | Spec ref |
|---|---|---|---|
| 1 | Demo household → `/household` | Empty state "Create your solar request"; "New request" visible in header and page | US3-1, FR-017 |
| 2 | New request | Step 1/4 "Location", map centred on Hyderabad, progress shows 4 steps | US1-1, FR-001 |
| 3 | Click the map; drag pin; type address + locality "Banjara Hills"; Continue | URL becomes `/household/requests/{id}?step=photo`; draft saved | US1-2, FR-003 |
| 4 | Back to step 1, type latitude `51.5` | Error "SURYAMIT currently supports locations in India" | FR-002 |
| 5 | Tab through step 1 without a mouse; use the coordinate inputs | Pin moves; all controls reachable | SC-007 |
| 6 | Step 2: choose a 7 MB file, then a PDF | "Photo must be 5 MB or smaller"; "Upload a JPEG, PNG or WebP photo" | FR-004 |
| 7 | Choose your roof photo | Progress bar, then preview; tick AI consent | US1-3, US1-4 |
| 8 | In Supabase Studio, download the stored object and inspect EXIF (e.g. `exiftool`) | No GPS / device / timestamp tags | US2-5, FR-006 |
| 9 | Step 3: units `0` → error; then 250 units, budget 150000, bill 2100, capacity 3 | Values saved; review opens; budget shown as ₹1,50,000 | US1-5, FR-009, FR-026 |
| 10 | Review: check grouped values, Edit links, privacy notice | All values shown; notice lists what vendors see/don't see | FR-011 |
| 11 | Remove budget via Edit (clear field) and return | Publish disabled; "Budget" listed with link to step 3 | US1-7, FR-012 |
| 12 | Restore budget; Publish → confirm dialog → Confirm | Request page, status "Open — awaiting quotes", toast; no edit controls | US1-6, FR-013 |
| 13 | Open `/household/requests/{id}?step=usage` | Read-only summary shown instead of the wizard | FR-014, FR-019 |
| 14 | Dashboard | Card shows Open, Banjara Hills, 250 units, ₹1,50,000, 3.0 kW, "Waiting for vendor quotes" | US3-2, US3-4 |
| 15 | Start another request, finish step 1 only, close the browser, sign in again, "Continue request" | Wizard opens at Roof photo with step-1 values restored | US4-1, SC-005 |
| 16 | On the published request, withdraw AI consent | Consent shown as withdrawn; re-granting is refused with explanation | US4-4, FR-008 |
| 17 | Sign up a second household; open the first household's request URL | Not-found page | US2-1 |
| 18 | As demo vendor, open `/household/requests/{id}` | Redirected to `/vendor` (001 role layout) | US2-3 |
| 19 | DevTools offline → try saving step 3 | Error with retry; values kept | FR-025 |
| 20 | 360 px viewport through all steps | No horizontal scroll | SC-007 |

## Automated tests

```bash
npm run test:unit -- tests/unit/domain/requests tests/unit/validation/requests.test.ts tests/unit/requests tests/unit/format.test.ts
npm run test:integration -- tests/integration/requests     # needs supabase start + npm run dev
npm run test:e2e -- tests/e2e/household-request.spec.ts tests/e2e/household-dashboard.spec.ts
```

Expected: all green — including the authorization matrix (other household / vendor / anonymous
× every operation), direct RLS and storage-policy denials, double-publish `409`, and the GPS-strip
assertion.
