# Research: Vendor Request Discovery

**Feature**: `004-vendor-request-discovery` | **Date**: 2026-11-01

All Technical Context items were resolvable from `docs/project-overview.md` §5–§12 and the
constitution; no NEEDS CLARIFICATION remained. Each real design choice is recorded below.

## R1. Enforce vendor privacy in the database, not only in the API

- **Decision**: Vendors get **no** RLS policy on `household_requests`. The only vendor read path is
  three `SECURITY DEFINER` functions (see data-model.md) that return an explicit, minimal column
  list (D-01), round coordinates to 2 decimals in SQL, filter to `status in ('open','quoted')`, and
  raise `42501` unless `auth.uid()` belongs to a `profiles` row with `role = 'vendor'`. The Route
  Handler also checks the role (defence in depth, constitution IV).
- **Rationale**:
  - RLS is row-level. Any `SELECT` policy granting vendors `open` rows would expose **all** columns
    (`address_text`, exact `latitude`/`longitude`, `user_id`, `monthly_bill`, `roof_photo_path`) to a
    vendor who calls the Supabase REST endpoint directly with their own JWT, bypassing our API.
  - Supabase exposes every table/function in `public` to the browser, so an API-only filter is not
    an access control (constitution IV: "UI hiding is never an access control").
  - Rounding inside SQL means an exact coordinate never leaves the database for a vendor caller.
  - A function is also browser-callable, which is acceptable precisely because its output is the
    permitted projection — the same data the dashboard shows.
- **Alternatives considered**:
  - *Vendor RLS policy on the base table + API column selection* — rejected: direct REST access
    leaks private columns.
  - *Column-level `GRANT`s* — rejected: households and vendors share the `authenticated` DB role,
    so revoking `address_text` would also break the owner household's own reads.
  - *`security_invoker` view* — rejected: it still needs a vendor RLS policy on the base table
    (same leak).
  - *Default (definer) view with `security_barrier`* — viable, but flagged by the Supabase linter as
    "security definer view", cannot take parameters (detail by id) and hides the role check in a
    `WHERE` clause; functions make the role check and grants explicit.

## R2. Functions instead of a view; three narrow functions

- **Decision**: `vendor_list_open_requests()`, `vendor_get_open_request(p_request_id)` and
  `vendor_get_latest_roof_assessment(p_request_id)`, each `STABLE`, `SECURITY DEFINER`,
  `SET search_path = public, pg_temp`, `EXECUTE` revoked from `public`/`anon` and granted to
  `authenticated`.
- **Rationale**: One function per read keeps each projection auditable and testable; fixed
  `search_path` prevents search-path hijacking of definer functions.
- **Alternatives**: one generic function with a mode flag (harder to audit); returning JSON blobs
  (loses typed columns and makes privacy tests weaker).

## R3. Roof photo: server-side signing, path never exposed

- **Decision**: After `vendor_get_open_request` confirms the vendor may see the request, the
  vendor detail module uses 001's server-only admin client (`src/lib/supabase/admin.ts`) to read
  `roof_photo_path` for that id (re-checking `status in ('open','quoted')`) and calls
  `createSignedUrl(path, 600)` on the private `roof-photos` bucket. The response contains only
  `{ url, expires_at }`. Signing failure returns `roof_photo_status: "unavailable"` (non-fatal).
- **Rationale**: The path `roof-photos/{user_id}/{request_id}/…` embeds the household's account id,
  so it must not be returned by a browser-callable function. Adding a vendor storage policy would
  similarly allow listing household folders. The service-role key stays server-side (overview §11).
- **Alternatives**: storage RLS policy for vendors (leaks folder structure / user ids); returning
  the path from the definer function (browser-callable leak); public bucket (violates constitution IV).

## R4. Roof-assessment summary tolerant of feature 008 not being deployed

- **Decision**: `vendor_get_latest_roof_assessment` is PL/pgSQL and first checks
  `to_regclass('public.roof_assessments')`; if null it returns no rows. Otherwise it returns the
  latest row with `status = 'completed'` (D-09) for an `open`/`quoted` request: `observations`,
  `potential_obstructions`, `limitations`, `site_survey_required`, `created_at AS assessed_at`.
  It never returns `model`, `prompt_version` or failed rows.
- **Rationale**: 004 ships before 008 (overview §14). PL/pgSQL plans statements lazily, so the
  function can be created before the table exists. No vendor RLS policy is needed on
  `roof_assessments` (same pattern as R1).
- **Alternatives**: require 008 to add a vendor RLS policy (cross-feature coupling and same
  column-exposure issue); omit the summary until 008 (loses D-01 value once 008 lands).

## R5. Filtering and sorting in a pure domain module

- **Decision**: The list function returns all visible requests (permitted columns); the Route
  Handler validates filters with Zod and calls `applyDiscoveryFilters` and `sortDiscoveryResults`
  from `src/lib/domain/requests/discovery.ts`, then truncates to 200 and sets `truncated`.
- **Rationale**: Filter correctness is a required test; pure functions are trivially unit-tested
  with boundary values (inclusive ranges, nulls, combinations). The MVP dataset is tiny.
- **Alternatives**: SQL `WHERE` with parameters (harder to unit-test, splits logic between SQL and
  TS); PostGIS `ST_DWithin` (production approach, overview §11, forbidden in MVP by constitution VIII).

## R6. Distance: haversine to the rounded location

- **Decision**: `haversineKm(a, b)` with Earth radius 6371 km, measured from the vendor's base
  (`vendors.latitude/longitude`) to the request's 2-dp approximate location; displayed rounded to
  1 km and prefixed "≈". `within_service_area = distance_km <= service_radius_km`. If the vendor
  has no base location, `distance_km` and `within_service_area` are `null`, no distance filter is
  applied and sort falls back to newest.
- **Rationale**: Using rounded coordinates means distance cannot be used to trilaterate a more
  precise location than the vendor already sees.
- **Alternatives**: distance to exact location computed in SQL (precision leak); road distance via
  a routing API (new third-party dependency, not needed).

## R7. Coordinating the shared route files with 002

- **Decision**: 002 owns `src/app/api/requests/route.ts` and `[id]/route.ts`. 004 inserts a role
  switch in each `GET` that delegates to `src/app/api/requests/_vendor/*.ts` (Next.js private
  folder, not routed). The household branch is not modified.
- **Rationale**: Keeps the overview §8 catalogue (one path, two roles) while minimising merge
  conflicts between parallel developers.
- **Alternatives**: separate `/api/vendor/requests` path (contradicts overview §8); one handler
  with interleaved logic (merge conflicts, harder review).

## R8. Map: react-leaflet, client-only, list as accessible fallback

- **Decision**: `src/components/maps/vendor-requests-map.tsx` uses `react-leaflet` with OSM tiles
  (attribution shown), loaded via `next/dynamic` with `ssr: false`. Markers at approximate
  locations; a `Circle` of `service_radius_km * 1000` m around the vendor base; popups show the card
  summary and a detail link. Tile error → banner offering the list.
- **Rationale**: Stack fixed by constitution; Leaflet needs `window`. Map is not keyboard-friendly,
  so the list view is the accessible equivalent (FR-027, US4 scenario 5).
- **Alternatives**: Google Maps (new key, not in stack); marker clustering plugin (extra dependency,
  unnecessary at demo scale — overlapping markers are offset slightly instead).

## R9. Filter state in the URL

- **Decision**: Filters are URL search params (`max_distance_km`, `locality`, `min_capacity_kw`,
  `max_capacity_kw`, `min_budget`, `max_budget`, `sort`) shared by the page and the API.
  `max_distance_km=any` disables the default radius filter.
- **Rationale**: Reloadable/shareable filtered views (FR-018) and one schema for client + server.
- **Alternatives**: component state only (lost on reload); local storage (not shareable).

## R10. Same 404 for hidden statuses and missing ids

- **Decision**: Vendor detail returns `404 NOT_FOUND` for `draft`, `accepted`, `closed` and
  nonexistent ids; malformed ids return `400 VALIDATION_FAILED`.
- **Rationale**: Avoids an existence oracle (FR-012). Post-acceptance access for the winning vendor
  belongs to 007.
- **Alternatives**: `403` for hidden statuses (confirms existence).

## R11. API field naming

- **Decision**: JSON fields are `snake_case`, matching DB columns and the plan §14 contracts
  (e.g. `approx_latitude`, `preferred_capacity_kw`).
- **Rationale**: One vocabulary across SQL, API and docs; no mapping layer.
- **Alternatives**: camelCase API (requires mapping; inconsistent with plan JSON examples).

## R12. Test strategy

- **Decision**: Vitest unit tests for `discovery.ts` and the filter schema; Vitest integration
  tests against local Supabase (`supabase start`) signing in as demo users with 001's test helpers,
  calling both the Route Handlers and the DB directly (direct `select` on `household_requests`,
  direct `rpc(...)`, direct storage download) to prove DB-level privacy; one Playwright smoke.
- **Rationale**: Constitution VI requires authorization tests; direct-DB tests prove FR-007.
- **Alternatives**: mocking Supabase (would not prove RLS/function behaviour).
