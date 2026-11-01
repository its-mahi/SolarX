# Implementation Plan: Vendor Request Discovery

**Branch**: `004-vendor-request-discovery` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-vendor-request-discovery/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Give vendors a dashboard listing every household request in `open` or `quoted` status (P0), an
optional Leaflet/OpenStreetMap view with the vendor's own service-radius circle (P1), filters for
distance, locality, capacity and budget, and a privacy-safe request detail page with a short-lived
roof-photo link and the latest roof-assessment summary.

Technical approach: privacy is enforced **in the database**. Feature 004 adds no vendor RLS policy
to `household_requests` (RLS is row-level and would expose every column); instead it adds three
`SECURITY DEFINER` SQL functions that return only the D-01 permitted columns, with coordinates
rounded to 2 decimals, only for `open`/`quoted` requests, and only to callers whose profile role is
`vendor`. The vendor branch of `GET /api/requests` and `GET /api/requests/:id` (route files owned by
002) is added behind a role switch that delegates to two feature-local modules. Filtering and
distance sorting run in a pure domain module (`src/lib/domain/requests/discovery.ts`) so filter
correctness is fully unit-tested. The roof photo is signed server-side (≤ 600 s) and its storage
path never leaves the server. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js LTS as used by Next.js; SQL (PostgreSQL 15
via Supabase) for the migration

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Tailwind CSS, shadcn/ui,
Lucide, Zod, `@supabase/supabase-js` / `@supabase/ssr` (from 001), `leaflet` + `react-leaflet`
(OpenStreetMap tiles; introduced by 002 for the map pin — this feature reuses them and adds them
only if absent). No other new runtime dependency.

**Storage**: Supabase PostgreSQL (reads `household_requests`, `profiles`, `vendors`, and
`roof_assessments` when present); Supabase Storage private bucket `roof-photos` (read via signed
URL only)

**Testing**: Vitest (unit + integration against local Supabase), Playwright (one vendor-discovery
smoke test) — D-08

**Target Platform**: Web (mobile-first responsive), deployed on Vercel + Supabase

**Project Type**: Single Next.js web application (UI + Route Handlers)

**Performance Goals**: Dashboard list visible within 2 s for up to 200 open requests (SC-006)

**Constraints**: No exact coordinates, address, name, phone, monthly bill, user id or storage path
in any vendor-facing response; signed URL expiry ≤ 600 s; no PostGIS in MVP (constitution VIII)

**Scale/Scope**: Hackathon dataset (tens of requests, 3 demo vendors); 2 pages, 2 route-handler
branches, 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Complete Workflow First | PASS | Delivers the P0 "vendor sees open requests" step with no AI dependency; the map (P1) is a separate story and the roof-assessment summary is optional at runtime. |
| II. Deterministic Core, Advisory AI | PASS | Filtering, distance and sorting are pure, unit-tested code; AI roof observations are only displayed (read-only), never used to filter or rank. |
| III. Untrusted Input | PASS | Query parameters and route params are Zod-validated on the server; no AI call is made; roof-assessment text is rendered as plain text. |
| IV. Security and Privacy by Default | PASS | Server role check in both route branches **and** DB-level enforcement via restricted security-definer functions; no vendor RLS policy on the base table; coordinates rounded to 2 dp in SQL; private bucket + 600 s signed URLs; logs exclude personal data and URLs. |
| V. Transparent, Sourced Estimates | PASS (N/A) | No estimates are shown to vendors in this feature. Roof observations are labelled "AI-generated visible observations, not a site survey". |
| VI. Targeted Mandatory Testing | PASS | Unit tests for filters/distance; integration tests for privacy (no forbidden fields), visibility (draft/accepted/closed hidden, direct-table read denied) and filter correctness; one Playwright smoke. |
| VII. Graceful Degradation | PASS | Loading/empty/success/error states on both pages; photo failure and missing roof assessment are non-fatal; map failure falls back to list. |
| VIII. Hackathon-Scale Simplicity | PASS | No new services; filtering in app code over a small result set; PostGIS documented as production-only; only `leaflet`/`react-leaflet` named as dependencies. |

**Post-design re-check (after Phase 1)**: PASS — data-model adds 3 functions and 1 index (no new
tables, no new RLS policies); contracts reuse the shared envelope and error codes; nothing violates
I–VIII. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/004-vendor-request-discovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── vendor-requests.md   # GET /api/requests (vendor), GET /api/requests/:id (vendor)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 20261101000400_vendor_request_discovery.sql   # NEW: 3 security-definer functions + status index

src/
├── app/
│   ├── api/requests/
│   │   ├── route.ts                       # MODIFY (owned by 002): GET role switch → vendor branch
│   │   ├── [id]/route.ts                  # MODIFY (owned by 002): GET role switch → vendor branch
│   │   └── _vendor/                       # NEW (private folder, not routed)
│   │       ├── list-open-requests.ts      # vendor list: RPC → domain filters → envelope
│   │       └── get-open-request.ts        # vendor detail: RPC → signed photo URL → roof summary
│   └── vendor/
│       ├── dashboard/page.tsx             # NEW: vendor dashboard (list/map)
│       └── requests/[id]/page.tsx         # NEW: privacy-safe request detail
├── components/
│   ├── vendor/
│   │   ├── vendor-discovery.tsx           # NEW: client container (fetch, URL filters, states, view toggle)
│   │   ├── request-filters.tsx            # NEW
│   │   ├── request-list.tsx               # NEW
│   │   ├── request-card.tsx               # NEW
│   │   ├── request-detail.tsx             # NEW
│   │   ├── roof-assessment-summary.tsx    # NEW
│   │   └── privacy-notice.tsx             # NEW
│   └── maps/
│       └── vendor-requests-map.tsx        # NEW: Leaflet map (client-only, dynamic import)
└── lib/
    ├── domain/requests/discovery.ts       # NEW: haversineKm, applyDiscoveryFilters, sortDiscoveryResults
    └── validation/vendor-discovery.ts     # NEW: filter query schema, response schemas/types

tests/
├── fixtures/discovery-requests.ts         # NEW: filter/visibility dataset
├── unit/domain/requests/discovery.test.ts # NEW
├── unit/validation/vendor-discovery.test.ts # NEW
├── integration/requests/
│   ├── vendor-discovery-privacy.test.ts   # NEW
│   ├── vendor-discovery-visibility.test.ts # NEW
│   └── vendor-discovery-filters.test.ts   # NEW
└── e2e/vendor-discovery.spec.ts           # NEW
```

**Structure Decision**: Single Next.js application per overview §6. Pages live under
`src/app/vendor/`, Route Handler branches under `src/app/api/requests/` (shared with 002 via a role
switch; the vendor logic lives in the `_vendor/` private folder so 002 and 004 edit different files
and only a few lines of each `route.ts`). Pure logic is in `src/lib/domain/requests/` and shared Zod
schemas in `src/lib/validation/`. Reused, not created: 001's `src/lib/api/{respond,errors,auth-guard}.ts`,
`src/lib/supabase/{server,admin}.ts` and vendor-area layout/guard; 002's `household_requests` table,
its RLS and the `roof-photos` bucket.

**Coordination with 002 (route switch)**: in each `GET` export, after 001's auth guard resolves the
profile, the handler does `if (profile.role === 'vendor') return <vendor module>(...)`; otherwise the
existing household branch runs unchanged. Non-`GET` methods are untouched.

## Complexity Tracking

No violations; section intentionally empty.
