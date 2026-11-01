# Quickstart: Vendor Request Discovery

**Feature**: `004-vendor-request-discovery` · Contracts: [contracts/vendor-requests.md](contracts/vendor-requests.md) ·
Data: [data-model.md](data-model.md)

## Prerequisites

- Features `001-platform-foundation-auth` and `002-household-solar-request` implemented (auth,
  demo accounts, `profiles`, `vendors` with base location and radius, `household_requests`,
  `roof-photos` bucket, household branch of `/api/requests`).
- Supabase CLI and Docker for a local stack; Node.js; `.env.local` with
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (server only).
- Optional: `008-roof-photo-analysis` for the roof-assessment summary (otherwise "No roof
  assessment available" is expected).

## Run

```bash
supabase start
supabase db reset          # applies all migrations incl. 20261101000400_vendor_request_discovery.sql, then seed.sql
npm run dev                # http://localhost:3000
```

## Manual acceptance walkthrough

Use the demo household to publish the "Sharma Residence (Demo)" request (002) and keep one extra
request in `draft`. Then sign in as a demo vendor (e.g. SunRise Energy).

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Open `/vendor/dashboard` | Loading state, then list shows the published request (locality, ≈ distance, 250 units, ₹1,50,000, 3 kW, "Demo" badge); draft request absent | US1-1, US1-2, FR-028 |
| 2 | DevTools → Network → `GET /api/requests` response | No `address_text`, `name`, `phone`, `user_id`, `monthly_bill`, `roof_photo_path`; lat/lng have ≤ 2 decimals | US1-3, FR-005, FR-006 |
| 3 | In the browser console run a direct Supabase `from('household_requests').select('*')` with the vendor session | Returns `[]` | FR-007 |
| 4 | Click the request | Detail shows photo, privacy notice "exact address and contact shared only after acceptance", roof summary or "No roof assessment available" | US2-1, US2-4, FR-008 |
| 5 | Copy the photo URL, wait > 10 min, open it | Access denied / expired; reloading detail issues a new URL | US2-2, FR-010 |
| 6 | Visit `/vendor/requests/<draft-request-id>` | "Not available" state (same as a random uuid) | US2-5, FR-012 |
| 7 | Default filter chip shows "Within 25 km" (vendor radius); set capacity 3–5, budget 1,00,000–2,00,000, locality "kond" | Only matching requests; URL updates; reload keeps filters; "Clear filters" resets | US3-1..4, FR-014..FR-018 |
| 8 | Set min budget 200000, max budget 100000 | Field-level validation message; previous results remain | US3-5, FR-017 |
| 9 | Switch to Map | Markers at approximate positions, vendor base marker and radius circle; popup has "View details"; same set as list | US4-1..3, FR-019..FR-021 |
| 10 | Block `tile.openstreetmap.org` in DevTools, reload map | Banner offers list view; list works | US4-4, FR-022 |
| 11 | Sign in as the household and call `GET /api/requests` | Household sees only its own requests (002 behaviour) | US1-6, FR-023 |
| 12 | Sign out; open `/vendor/dashboard` and `GET /api/requests` | Redirect to sign-in; API `401 UNAUTHENTICATED` | FR-023 |
| 13 | Resize to 375 px width; tab through filters and view toggle | Usable layout; all fields labelled and keyboard reachable | FR-027 |

## Automated tests

```bash
npx vitest run tests/unit/domain/requests/discovery.test.ts tests/unit/validation/vendor-discovery.test.ts
npx vitest run tests/integration/requests/vendor-discovery-privacy.test.ts \
               tests/integration/requests/vendor-discovery-visibility.test.ts \
               tests/integration/requests/vendor-discovery-filters.test.ts   # needs `supabase start`
npx playwright test tests/e2e/vendor-discovery.spec.ts
```

Expected: all pass; privacy suite asserts zero forbidden fields (SC-002); visibility suite asserts
zero hidden-status rows through API, RPC and direct table access (SC-003); filter suite matches the
expected subsets exactly (SC-004).
