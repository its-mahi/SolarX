# Implementation Plan: Platform Foundation and Authentication

**Branch**: `001-platform-foundation-auth` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-platform-foundation-auth/spec.md`

## Summary

Bootstrap the single SURYAMIT Next.js application and everything every later feature builds on:
project scaffolding (TypeScript strict, Tailwind, shadcn/ui, Vitest, Playwright, env template),
the three Supabase clients, the shared API layer (`src/lib/api/`: response envelope, error codes,
auth guard, safe logging), the shared Zod vocabulary (`src/lib/validation/`), the `profiles` and
`vendors` tables with RLS and guard triggers, the demo seed skeleton with the four fictional
demo accounts (D-07), and the user-facing pieces: landing page, sign-up with role, sign-in,
one-click demo sign-in, role-based routing, account page and the branded app shell.

Technical approach: sign-in and sign-out use the Supabase browser client directly (overview §5
"sign-in" edge); sign-up and demo sign-in go through Route Handlers so that the body is
Zod-validated and the demo password never leaves the server. A database trigger on
`auth.users` creates the `profiles` row (and the `vendors` row for vendors) atomically with the
account, and validates the role at the data layer, so no route — including a direct call to the
identity service — can create an invalid role. Role routing is enforced three times: middleware
(anonymous → `/login`), role layouts (`/household/*`, `/vendor/*`), and `requireRole()` inside
every Route Handler, backed by RLS.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`) on Node.js 20 LTS or newer

**Primary Dependencies**: Next.js (App Router, Route Handlers; latest stable at bootstrap, ≥ 15) + React; Tailwind CSS; shadcn/ui (Radix primitives); Lucide icons; `@supabase/supabase-js`; `@supabase/ssr`; Zod; `server-only`; `next/font` (Inter)

**Storage**: Supabase PostgreSQL with RLS (`profiles`, `vendors`); Supabase Auth (email + password). No storage buckets in this feature.

**Testing**: Vitest (unit + integration against local Supabase), Playwright (e2e) — D-08; dev-only `@axe-core/playwright` for the automated WCAG AA check (SC-006)

**Target Platform**: Modern evergreen browsers (mobile-first, ≥ 360 px); Vercel (Node runtime) + Supabase cloud; local dev via Supabase CLI (Docker)

**Project Type**: Single full-stack web application (UI + Route Handlers in one Next.js app)

**Performance Goals**: Demo one-click sign-in to role home < 5 s (SC-001); landing page interactive < 2 s on broadband

**Constraints**: Secrets server-only (constitution IV); every body Zod-validated (III); shared error envelope (VII); WCAG AA; hackathon build window (VIII)

**Scale/Scope**: Hackathon demo: 4 demo accounts + a handful of self-registered users; ~6 pages, 3 Route Handler files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence in this plan |
|---|---|---|
| I. Complete Workflow First | PASS | Delivers only the P0 prerequisites (auth, roles, shell, demo accounts) the request → quote → compare → accept flow needs; no AI. |
| II. Deterministic Core, Advisory AI | PASS | No AI. Role routing and redirect safety are pure functions in `src/lib/auth/redirects.ts`, unit-tested. |
| III. Untrusted Input & Prompt-Injection | PASS | Every Route Handler body is parsed with a strict Zod schema (`src/lib/validation/auth.ts`, `profile.ts`); unknown keys rejected; DB trigger re-validates role. No AI calls. |
| IV. Security & Privacy by Default | PASS | `requireUser`/`requireRole` in every handler + RLS on `profiles`/`vendors`; guard triggers keep `role`, `is_demo`, `verification_status` immutable for users; service-role key and demo password only in server env (`import "server-only"`); Origin check on cookie-authenticated mutations; logger allowlist excludes PII and secrets. |
| V. Transparent, Sourced Estimates | PASS (n/a) | No estimates. Footer carries the "estimates only" note and links to `/rules` (003). |
| VI. Targeted Mandatory Testing | PASS | Authorization/RLS integration tests (profiles, vendors, role guards, immutability) and auth e2e are written before implementation; error-envelope and redirect unit tests. Domain-logic, acceptance, injection and AI tests are owned by 003/006/007/009/008. |
| VII. Graceful Degradation | PASS | Shared `LoadingState`/`EmptyState`/`ErrorState` components; root `error.tsx`/`not-found.tsx`; `toErrorResponse()` maps every unknown error to `INTERNAL` with a generic message. |
| VIII. Hackathon-Scale Simplicity | PASS | One Next.js app + Supabase. New runtime deps named above (all from the fixed stack plus `@supabase/ssr` and `server-only`, both thin). No extra services. |

**Post-design re-check (after Phase 1)**: PASS — data-model adds only the two §7 tables owned by
001, three helper functions and guard triggers; contracts add four auth-related endpoints
(listed under "Extensions to overview §8" in [contracts/auth-api.md](contracts/auth-api.md) and
[contracts/me-api.md](contracts/me-api.md)) that do not alter any existing path; no violations,
so Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-foundation-auth/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # profiles, vendors, helper functions, RLS
├── quickstart.md        # Setup, run, manual acceptance walkthrough, tests
├── contracts/
│   ├── shared-conventions.md  # envelope, error codes, guard + module interfaces for all features
│   ├── auth-api.md            # POST /api/auth/signup, POST /api/auth/demo
│   ├── me-api.md              # GET /api/me, PATCH /api/me
│   └── ui-routes.md           # pages, redirects, app shell, extension points
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

Files this feature creates (C) or that later features are expected to modify (M→ feature):

```text
package.json                         C  scripts: dev, build, start, lint, typecheck, test, test:unit, test:integration, test:e2e, db:reset
tsconfig.json                        C  strict, path alias @/* → src/*
next.config.ts                       C
postcss.config.mjs                   C  Tailwind
eslint.config.mjs                    C
components.json                      C  shadcn/ui config
vitest.config.ts                     C  projects: unit (tests/unit), integration (tests/integration)
playwright.config.ts                 C  tests/e2e, webServer = npm run dev
.env.example                         C  all env vars (overview §11 + DEMO_* below)
.gitignore                           C
supabase/config.toml                 C  supabase init; email confirmations off for local
supabase/migrations/20261101000100_platform_foundation_auth.sql   C
supabase/seed.sql                    C  001 section (demo accounts); M→ later features append sections

src/middleware.ts                    C  session refresh + anonymous redirect for /household, /vendor, /account
src/app/layout.tsx                   C  root layout, Inter font, Toaster
src/app/globals.css                  C  SURYAMIT theme tokens (Tailwind + shadcn CSS variables)
src/app/page.tsx                     C  landing page
src/app/error.tsx                    C  root error boundary (ErrorState)
src/app/not-found.tsx                C
src/app/login/page.tsx               C
src/app/login/sign-in-form.tsx       C
src/app/signup/page.tsx              C
src/app/signup/sign-up-form.tsx      C
src/app/account/page.tsx             C  own profile (US4)
src/app/account/profile-form.tsx     C
src/app/household/layout.tsx         C  requirePageRole('household') + AppShell
src/app/household/page.tsx           C  placeholder home; M→ 002 (dashboard)
src/app/vendor/layout.tsx            C  requirePageRole('vendor') + AppShell
src/app/vendor/page.tsx              C  placeholder home; M→ 004 (vendor dashboard)
src/app/api/auth/signup/route.ts     C  POST
src/app/api/auth/demo/route.ts       C  POST
src/app/api/me/route.ts              C  GET, PATCH

src/components/ui/                   C  shadcn: button, input, label, card, badge, alert, dropdown-menu, radio-group, select, separator, skeleton, dialog, sonner
src/components/layout/app-shell.tsx  C
src/components/layout/site-header.tsx C
src/components/layout/site-footer.tsx C
src/components/layout/public-header.tsx C
src/components/layout/user-menu.tsx  C
src/components/layout/nav-config.ts  C  role nav items; M→ 002/004/005 add items
src/components/shared/brand-logo.tsx C
src/components/shared/demo-badge.tsx C
src/components/shared/demo-account-buttons.tsx C
src/components/shared/loading-state.tsx C
src/components/shared/empty-state.tsx C
src/components/shared/error-state.tsx C
src/components/shared/field-error.tsx C

src/lib/utils.ts                     C  cn()
src/lib/env.ts                       C  Zod-validated publicEnv (NEXT_PUBLIC_* only)
src/lib/env.server.ts                C  Zod-validated serverEnv() (import "server-only")
src/lib/supabase/server.ts           C  createServerSupabase(request?) — cookies or Bearer token, anon key, RLS applies
src/lib/supabase/browser.ts          C  createBrowserSupabase()
src/lib/supabase/admin.ts            C  createAdminSupabase() — service role, server-only
src/lib/supabase/middleware.ts       C  updateSession() helper used by src/middleware.ts
src/lib/supabase/database.types.ts   C  generated types; M→ every feature regenerates after its migration
src/lib/api/errors.ts                C  ApiError, ERROR_CODES, HTTP status map, toErrorResponse()
src/lib/api/respond.ts               C  ok(), created(), fail(), withApiHandler(), parseJsonBody()
src/lib/api/auth-guard.ts            C  requireUser(), requireRole(), requirePageRole(), assertSameOrigin()
src/lib/api/log.ts                   C  logEvent() with field allowlist
src/lib/auth/redirects.ts            C  homePathForRole(), safeNextPath() — pure
src/lib/auth/demo-accounts.ts        C  server-only map of demo keys → email
src/lib/auth/demo-account-options.ts C  client-safe demo keys, labels and roles (no credentials)
src/lib/validation/enums.ts          C  ROLES, REQUEST_STATUSES, QUOTE_STATUSES, VERIFICATION_STATUSES, QUOTE_SOURCES, ROOF_ASSESSMENT_STATUSES
src/lib/validation/common.ts         C  uuid, inrAmount, kwCapacity, latitude, longitude, indianPhone, trimmedText()
src/lib/validation/auth.ts           C  signUpSchema, signInSchema, demoSignInSchema
src/lib/validation/profile.ts        C  profileUpdateSchema, vendorProfileUpdateSchema

tests/helpers/env.ts                 C  loads .env.local / .env.test for tests
tests/helpers/supabase.ts            C  anon/admin clients, signInAs(email, password)
tests/helpers/users.ts               C  createTestUser({ role }), deleteTestUser()
tests/helpers/api.ts                 C  apiFetch(path, { token, method, body, origin })
tests/unit/api/errors.test.ts        C
tests/unit/api/respond.test.ts       C
tests/unit/api/auth-guard.test.ts    C
tests/unit/auth/redirects.test.ts    C
tests/unit/validation/auth.test.ts   C
tests/unit/validation/profile.test.ts C
tests/integration/auth/rls-profiles-vendors.test.ts C
tests/integration/auth/demo-api.test.ts C
tests/integration/auth/signup-api.test.ts C
tests/integration/auth/me-api.test.ts C
tests/integration/auth/me-update-api.test.ts C
tests/integration/security/client-bundle-secrets.test.ts C
tests/e2e/auth-demo.spec.ts          C
tests/e2e/role-routing.spec.ts       C
tests/e2e/signup-signin.spec.ts      C
tests/e2e/responsive-a11y.spec.ts    C
```

**Structure Decision**: Single Next.js application at the repository root exactly as in overview
§6. Auth forms are colocated with their routes (`src/app/login/`, `src/app/signup/`,
`src/app/account/`) instead of a new component folder; reusable cross-feature pieces live in
`src/components/layout/` and `src/components/shared/`. Two small helper folders not spelled out
in §6 are added inside existing trees: `src/lib/auth/` (pure redirect helpers + server-only demo
map) and `tests/helpers/` (shared test clients reused by every later feature's authorization
tests).

## Extension points provided to later features

| Extension point | Location | Used by |
|---|---|---|
| Response envelope, error codes, `withApiHandler`, `parseJsonBody` | `src/lib/api/respond.ts`, `errors.ts` | every Route Handler |
| `requireUser()`, `requireRole(role)`, `requirePageRole(role)`, `assertSameOrigin()` | `src/lib/api/auth-guard.ts` | every Route Handler / role layout |
| `logEvent(event, fields)` with allowlisted keys | `src/lib/api/log.ts` | status-change logs (002, 005, 007) |
| Canonical enums + common Zod primitives | `src/lib/validation/enums.ts`, `common.ts` | 002–011 (import, never redefine) |
| `public.current_user_role()` SQL helper, `public.set_updated_at()` trigger fn | migration 001 | RLS policies and tables in 002–011 |
| Role navigation items | `src/components/layout/nav-config.ts` | 002 (New request), 004 (Open requests), 005 (My quotes) |
| Shared state components | `src/components/shared/*-state.tsx` | every screen (constitution VII) |
| Demo seed sections with fixed demo UUIDs | `supabase/seed.sql` | 004–009 demo requests/quotes |
| Test helpers (`signInAs`, `createTestUser`, `apiFetch`) | `tests/helpers/` | all authorization/RLS tests |
| Placeholder role homes | `src/app/household/page.tsx`, `src/app/vendor/page.tsx` | replaced by 002 and 004 |

## Environment variables

Overview §11 variables plus two server-only demo variables (an extension, reported):

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | admin client (tests, seed checks, narrowly scoped server operations) |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | server only | placeholders for 008+ (not read by 001) |
| `DEMO_ACCOUNTS_ENABLED` | server only | `true` shows demo buttons and enables `POST /api/auth/demo` |
| `DEMO_ACCOUNT_PASSWORD` | server only | shared password of the four seeded demo accounts |

## Complexity Tracking

Not required — the Constitution Check has no violations.
