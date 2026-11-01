---
description: "Task list for 001 Platform Foundation and Authentication"
---

# Tasks: Platform Foundation and Authentication

**Input**: Design documents from `/specs/001-platform-foundation-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED where constitution VI applies — authorization/RLS (profiles, vendors, role
guards, immutable columns) and the shared error envelope. Tests are written first and must fail
before the implementation task that follows them.

**Organization**: Setup and Foundational phases own ALL project-wide scaffolding (no later
feature re-scaffolds). Then one phase per user story in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the single Next.js application and tooling used by every feature.

- [X] T001 Scaffold the app at the repository root with `create-next-app` (TypeScript, App Router, Tailwind CSS, ESLint, `src/` directory, `@/*` alias) producing package.json, next.config.ts, postcss.config.mjs, eslint.config.mjs and tsconfig.json with `"strict": true` — *Impl note: Next.js 16.4.3 template wires Tailwind via `@tailwindcss/turbopack` in next.config.ts, so there is no postcss.config.mjs.*
- [X] T002 Add npm scripts to package.json: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (unit + integration), `test:unit` (`vitest run --project unit`), `test:integration` (`vitest run --project integration`), `test:e2e` (`playwright test`), `db:reset` (`supabase db reset`)
- [X] T003 [P] Install runtime dependencies `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`, `lucide-react` and dev dependencies `vitest`, `@playwright/test`, `@axe-core/playwright` in package.json
- [X] T004 [P] Initialise shadcn/ui (components.json, src/lib/utils.ts with `cn()`) and add button, input, label, card, badge, alert, dropdown-menu, radio-group, select, separator, skeleton, dialog and sonner under src/components/ui/
- [X] T005 [P] Create .env.example listing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `GEMINI_API_KEY` (server only), `GROQ_API_KEY` (server only, optional), `DEMO_ACCOUNTS_ENABLED`, `DEMO_ACCOUNT_PASSWORD` (server only) with comments, and .gitignore covering `.env*.local`, `.next/`, `playwright-report/`, `test-results/`, `supabase/.temp/`
- [X] T006 [P] Run `supabase init` to create supabase/config.toml and set `[auth.email] enable_confirmations = false` and `site_url = "http://localhost:3000"`
- [X] T007 [P] Create vitest.config.ts with projects `unit` (tests/unit/**, environment node, no network) and `integration` (tests/integration/**, sequential, 30 s timeout, setupFiles tests/helpers/env.ts) and create tests/helpers/env.ts loading `.env.local`/`.env.test`
- [X] T008 [P] Create playwright.config.ts (testDir tests/e2e, baseURL `http://localhost:3000`, webServer `npm run dev`, projects: desktop Chromium and mobile Chromium at 360×780)
- [X] T009 [P] Define SolarX theme tokens in src/app/globals.css (primary `#14532D`, accent `#22A55B`, mint `#E3F6EC`, background `#FAF8F3`, highlight `#F5B700`, foreground `#0F1F17`, destructive `#B42318`, visible focus ring) and the root layout src/app/layout.tsx (Inter via `next/font/google`, `<html lang="en">`, Sonner `<Toaster />`, metadata title "SolarX")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared API layer, vocabulary, clients, schema, seed, guard, shell. Blocks all stories
in this feature and all later features.

### Tests for Foundational (write first)

- [X] T010 [P] Unit test the error mapping in tests/unit/api/errors.test.ts: each `ErrorCode` → its HTTP status (`VALIDATION_FAILED` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `AI_UNAVAILABLE` 503, `INTERNAL` 500); `ZodError` → `VALIDATION_FAILED` with `details[{path,message}]`; Postgres `23505` → `CONFLICT`; unknown `Error('db exploded at SELECT …')` → `INTERNAL` whose body contains no stack, no SQL and the generic message
- [X] T011 [P] Unit test the envelope helpers in tests/unit/api/respond.test.ts: `ok`/`created` bodies are `{ data }` with 200/201; `fail` body is `{ error: { code, message, details: [] } }`; `parseJsonBody` rejects malformed JSON, empty body and unknown keys (strict schema) with `VALIDATION_FAILED`
- [X] T012 [P] Unit test redirect helpers in tests/unit/auth/redirects.test.ts: `homePathForRole` (`household`→`/household`, `vendor`→`/vendor`); `safeNextPath` accepts `/household/requests/new` for household and `/account` for both, rejects `//evil.com`, `https://evil.com`, `/\evil`, `javascript:…`, `/vendor` for a household, empty/undefined

### Implementation for Foundational

- [X] T013 [P] Create the canonical vocabulary in src/lib/validation/enums.ts: `ROLES = ['household','vendor']`, `REQUEST_STATUSES = ['draft','open','quoted','accepted','closed']`, `QUOTE_STATUSES = ['submitted','accepted','rejected','withdrawn']`, `VERIFICATION_STATUSES = ['unverified','demo']`, `QUOTE_SOURCES = ['manual','ai_extracted']`, `ROOF_ASSESSMENT_STATUSES = ['completed','failed']`, each with a `z.enum` and exported TS union type
- [X] T014 [P] Create shared primitives in src/lib/validation/common.ts: `uuidSchema`; `inrAmountSchema` (integer ≥ 0); `kwCapacitySchema` (positive, ≤ 2 decimals); `latitudeSchema` (−90..90); `longitudeSchema` (−180..180); `indianPhoneSchema` (accepts `9876543210`, `+91 98765 43210`, `+919876543210`; first digit 6–9; outputs `+91XXXXXXXXXX`); `trimmedText(min, max)`
- [X] T015 [P] Create src/lib/env.ts (Zod-validated `publicEnv`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and src/lib/env.server.ts (`import "server-only"`; lazily-parsed `serverEnv()`: `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_ACCOUNTS_ENABLED` boolean default false, `DEMO_ACCOUNT_PASSWORD` optional, `GEMINI_API_KEY`/`GROQ_API_KEY` optional)
- [X] T016 Implement src/lib/api/errors.ts per contracts/shared-conventions.md (`ErrorCode`, `HTTP_STATUS`, `ApiError`, `toErrorResponse` mapping ZodError/SyntaxError/`23505`; everything else → `INTERNAL` "Something went wrong. Please try again." + `logEvent('api.internal_error')`) so T010 passes
- [X] T017 Implement src/lib/api/respond.ts (`ok`, `created`, `fail`, `withApiHandler`, `parseJsonBody`) so T011 passes (depends on T016)
- [X] T018 [P] Implement src/lib/api/log.ts `logEvent(event, fields)` emitting one JSON line and dropping every key not in the allowlist `userId, role, requestId, quoteId, fromStatus, toStatus, code, demoKey, reason`
- [X] T019 [P] Implement pure `homePathForRole` and `safeNextPath` in src/lib/auth/redirects.ts so T012 passes
- [X] T020 [P] Create src/lib/supabase/browser.ts (`createBrowserSupabase()` with public env) and src/lib/supabase/admin.ts (`createAdminSupabase()` using `SUPABASE_SERVICE_ROLE_KEY`, `import "server-only"`, `persistSession: false`)
- [X] T021 Create src/lib/supabase/server.ts `createServerSupabase(request?)` (uses `Authorization: Bearer` token when present, otherwise `@supabase/ssr` cookies; anon key so RLS applies) and src/lib/supabase/middleware.ts `updateSession(request)` that refreshes the session cookie
- [X] T022 Write part 1 of supabase/migrations/20261101000100_platform_foundation_auth.sql: functions `public.set_updated_at()`, `public.is_privileged_session()`, and table `profiles` (`id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`, `name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100)`, `phone text NULL CHECK (phone IS NULL OR phone ~ '^\+91[6-9][0-9]{9}$')`, `role text NOT NULL CHECK (role IN ('household','vendor'))`, `is_demo boolean NOT NULL DEFAULT false`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`) and `public.current_user_role()` (`STABLE SECURITY DEFINER`, `search_path = ''`, EXECUTE to `authenticated`)
- [X] T023 Add table `vendors` to supabase/migrations/20261101000100_platform_foundation_auth.sql (`id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `company_name text NOT NULL CHECK (char_length(btrim(company_name)) BETWEEN 2 AND 120)`, `service_area text NOT NULL CHECK (char_length(btrim(service_area)) BETWEEN 2 AND 200)`, `latitude numeric(9,6) NULL CHECK (latitude BETWEEN -90 AND 90)`, `longitude numeric(9,6) NULL CHECK (longitude BETWEEN -180 AND 180)`, `service_radius_km integer NOT NULL DEFAULT 25 CHECK (service_radius_km BETWEEN 1 AND 500)`, `verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','demo'))`, timestamps, `CHECK ((latitude IS NULL) = (longitude IS NULL))`) with `set_updated_at` triggers on both tables
- [X] T024 Add `public.handle_new_user()` (`SECURITY DEFINER`, `search_path = ''`) and the `AFTER INSERT ON auth.users` trigger to supabase/migrations/20261101000100_platform_foundation_auth.sql: raise if metadata `role` not in (`household`,`vendor`); insert `profiles` with `is_demo = false` (ignore metadata `is_demo`); for vendors raise if `company_name` or `service_area` missing, else insert `vendors` with `coalesce(service_radius_km, 25)` and `verification_status = 'unverified'`
- [X] T025 Add guard triggers and RLS to supabase/migrations/20261101000100_platform_foundation_auth.sql: `profiles_guard_update` (block changes to `id`, `role`, `is_demo` unless `is_privileged_session()`), `vendors_guard_write` (owner profile must have role `vendor`; block changes to `user_id`, `verification_status` unless privileged); `ENABLE ROW LEVEL SECURITY` on both; policies `profiles_select_own` (SELECT `id = auth.uid()`), `profiles_update_own` (UPDATE using/with check `id = auth.uid()`), `vendors_select_authenticated` (SELECT to authenticated `true`), `vendors_update_own` (UPDATE using/with check `user_id = auth.uid()`); no INSERT/DELETE policies
- [X] T026 Create supabase/seed.sql section "001 — demo accounts": four `auth.users` + `auth.identities` rows with the fixed UUIDs, `example.com` emails and bcrypt password from research.md R-10, then `UPDATE profiles SET is_demo = true` and `UPDATE vendors SET verification_status = 'demo'`, base coordinates and radii per R-10; end the file with empty commented sections `-- 002` … `-- 011` for later features
- [X] T027 Generate src/lib/supabase/database.types.ts with `supabase gen types typescript --local` after `npm run db:reset`
- [X] T028 Implement src/lib/api/auth-guard.ts (`import "server-only"`): `requireUser(req)` (UNAUTHENTICATED when no session or no profile row), `requireRole(req, role)` (FORBIDDEN on other role; returns `vendor` row for vendors), `requirePageRole(role)` (redirect anonymous to `/login?next=`, wrong role to own home), `assertSameOrigin(req, authVia)` (FORBIDDEN for cookie-authenticated POST/PATCH/DELETE without matching `Origin`)
- [X] T029 Implement src/middleware.ts calling `updateSession()` and redirecting anonymous requests for `/household/:path*`, `/vendor/:path*`, `/account` to `/login?next=<path>`; matcher excludes static assets and `/api/*` — *Impl note: Next.js 16 renamed Middleware to Proxy, so this is `src/proxy.ts` (research R-14).*
- [X] T030 [P] Create shared state components src/components/shared/loading-state.tsx, src/components/shared/empty-state.tsx, src/components/shared/error-state.tsx and src/components/shared/field-error.tsx per contracts/ui-routes.md (ErrorState never renders technical detail; FieldError uses `role="alert"`)
- [X] T031 [P] Create src/components/shared/brand-logo.tsx (Lucide Sun + "SolarX" wordmark) and src/components/shared/demo-badge.tsx ("Demo" pill with AA-contrast text)
- [X] T032 Create the app shell: src/components/layout/nav-config.ts (`NAV_ITEMS` household: Dashboard `/household`; vendor: Open requests `/vendor`), src/components/layout/site-header.tsx, src/components/layout/user-menu.tsx (name, role label, Account link, Sign out via browser client → `/`), src/components/layout/site-footer.tsx ("Rules & sources" → `/rules`; "SolarX shows estimates only. It is not a government service and does not guarantee subsidy."), src/components/layout/public-header.tsx and src/components/layout/app-shell.tsx (mobile menu below 768 px, 16 px gutters)
- [X] T033 [P] Create src/app/error.tsx (client error boundary rendering ErrorState with retry) and src/app/not-found.tsx
- [X] T034 [P] Create shared test helpers tests/helpers/supabase.ts (`anonClient()`, `adminClient()`, `signInAs(email, password)` returning client + access token), tests/helpers/users.ts (`createTestUser({ role, vendor? })` via admin API with metadata, `deleteTestUser(id)`) and tests/helpers/api.ts (`apiFetch(path, { token?, method, body?, origin? })` against `TEST_BASE_URL` default `http://localhost:3000`)

**Checkpoint**: Foundation ready — `npm run db:reset` succeeds, unit tests T010–T012 pass.

---

## Phase 3: User Story 1 - Try SolarX instantly with a demo account (Priority: P1) 🎯 MVP

**Goal**: Landing page + one-click demo sign-in into the right role area with Demo labels and sign-out.

**Independent Test**: From `/`, click "Try as demo household" → `/household` showing "Sharma Residence" + Demo; sign out; click GreenVolt Solar → `/vendor` with Demo.

### Tests for User Story 1 (write first)

- [X] T035 [P] [US1] Integration test tests/integration/auth/demo-api.test.ts for `POST /api/auth/demo`: each of `household`, `sunrise-energy`, `greenvolt-solar`, `solartech-solutions` → 200 with expected profile name, `is_demo: true`, `redirect_to`; unknown key → 400 `VALIDATION_FAILED`; cross-site `Origin` → 403 `FORBIDDEN`; response body never contains `DEMO_ACCOUNT_PASSWORD`; with `DEMO_ACCOUNTS_ENABLED=false` → 404 `NOT_FOUND` (run via a dedicated env override)
- [X] T036 [P] [US1] E2E test tests/e2e/auth-demo.spec.ts: landing shows core promise, 4-step how-it-works, household/vendor entry points and four demo buttons; demo household → `/household` with "Sharma Residence" and Demo badge; sign out → `/` and Back does not show protected content; demo GreenVolt Solar → `/vendor` with Demo badge

### Implementation for User Story 1

- [X] T037 [P] [US1] Create src/lib/auth/demo-accounts.ts (`import "server-only"`) mapping demo keys `household | sunrise-energy | greenvolt-solar | solartech-solutions` to email per research.md R-10, and src/lib/auth/demo-account-options.ts exporting the client-safe list of keys + button labels + role (no emails, no passwords)
- [X] T038 [P] [US1] Add `demoSignInSchema` (`{ account: z.enum(['household','sunrise-energy','greenvolt-solar','solartech-solutions']) }`, strict) to src/lib/validation/auth.ts
- [X] T039 [US1] Implement `POST` in src/app/api/auth/demo/route.ts with `withApiHandler`: 404 `NOT_FOUND` unless `DEMO_ACCOUNTS_ENABLED`; `assertSameOrigin`; parse `demoSignInSchema`; sign out any existing session; `signInWithPassword` with `DEMO_ACCOUNT_PASSWORD` via the cookie server client; load profile; return `{ profile, redirect_to }`; on failure return `INTERNAL` "Demo account is unavailable right now. Please try again or sign in."
- [X] T040 [US1] Create src/components/shared/demo-account-buttons.tsx: four labelled buttons ("Try as demo household — Sharma Residence", "Demo vendor — SunRise Energy", "— GreenVolt Solar", "— SolarTech Solutions"), per-button loading state, error toast with retry, then `router.replace(redirect_to)` + `router.refresh()`
- [X] T041 [US1] Build the landing page src/app/page.tsx with PublicHeader, hero (core promise + sub-copy from contracts/ui-routes.md), 4-step "How it works", household and vendor entry cards (Sign up / Sign in), demo section (rendered only when `DEMO_ACCOUNTS_ENABLED`) with "Fictional demo data. Vendors shown are not real or verified installers.", and SiteFooter; signed-in visitors see "Go to your dashboard"
- [X] T042 [US1] Create src/app/household/layout.tsx (`requirePageRole('household')`, wraps children in AppShell with profile) and placeholder home src/app/household/page.tsx ("Your dashboard is coming next" EmptyState; replaced by 002)
- [X] T043 [P] [US1] Create src/app/vendor/layout.tsx (`requirePageRole('vendor')`, AppShell) and placeholder home src/app/vendor/page.tsx (replaced by 004)
- [X] T044 [US1] Emit `logEvent('auth.demo_signin', { demoKey, userId })` and `logEvent('auth.demo_signin_failed', { demoKey, reason })` in src/app/api/auth/demo/route.ts

**Checkpoint**: Demo path works end to end; T035–T036 pass.

---

## Phase 4: User Story 2 - Each role stays in its own area (Priority: P1)

**Goal**: Prove and complete server-side + data-layer authorization for account data and role areas.

**Independent Test**: Run the RLS, guard and role-routing suites; all cross-role and cross-user attempts are refused with the standard envelope.

### Tests for User Story 2 (write first)

- [X] T045 [P] [US2] Integration test tests/integration/auth/rls-profiles-vendors.test.ts using direct Supabase clients: user A reads only own profile (B's returns 0 rows); anonymous reads 0 profiles; A cannot update B's profile or vendor row (0 rows affected); A cannot change own `role` or `is_demo` (error); vendor cannot change own `verification_status` or `user_id` (error); signed-in household can read vendors' business columns; no INSERT into `profiles`/`vendors` is allowed from the client
- [X] T046 [P] [US2] Integration test tests/integration/auth/me-api.test.ts for `GET /api/me`: no token → 401 `UNAUTHENTICATED` envelope; household token → own profile and `vendor: null`, `home_path: '/household'`; vendor token → own vendor row; token of an account whose profile row was deleted → 401
- [X] T047 [P] [US2] Unit test tests/unit/api/auth-guard.test.ts with a stubbed Supabase client factory: `requireRole(req,'vendor')` for a household → `ApiError FORBIDDEN`; no user → `UNAUTHENTICATED`; `assertSameOrigin` rejects cookie POST with foreign or missing `Origin`, accepts same origin, skips check for bearer auth
- [X] T048 [P] [US2] E2E test tests/e2e/role-routing.spec.ts: anonymous `/household` → `/login?next=/household`; demo household → `/vendor` redirected to `/household`; demo vendor → `/household` redirected to `/vendor`; `/login?next=https://evil.example` → role home after sign-in
- [X] T049 [P] [US2] Post-build security test tests/integration/security/client-bundle-secrets.test.ts scanning `.next/static/**` for the values of `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_ACCOUNT_PASSWORD`, `GEMINI_API_KEY` and `GROQ_API_KEY` (when set) — expects 0 matches

### Implementation for User Story 2

- [X] T050 [US2] Implement `GET` in src/app/api/me/route.ts with `withApiHandler` + `requireUser`, returning `{ profile (with email), vendor | null, home_path }` per contracts/me-api.md using the RLS-bound client
- [X] T051 [US2] Add `logEvent('auth.unauthenticated'|'auth.forbidden', { userId?, role?, reason })` to the refusal paths in src/lib/api/auth-guard.ts (no emails, tokens or paths with personal data)

**Checkpoint**: Authorization suites T045–T049 pass.

---

## Phase 5: User Story 3 - Create an account with a role and sign in (Priority: P2)

**Goal**: Self-service sign-up (household or vendor) and email/password sign-in with role routing.

**Independent Test**: Sign up a household and a vendor, land in each area, sign out and back in; invalid inputs show field errors.

### Tests for User Story 3 (write first)

- [X] T052 [P] [US3] Unit test tests/unit/validation/auth.test.ts for `signUpSchema`: name 1–100 (0 and 101 rejected), password 8–72 (7 rejected), email lower-cased, phone normalization and rejection of `12345`/`5876543210`, vendor requires `company_name` 2–120 and `service_area` 2–200, `service_radius_km` 1–500 default 25, latitude without longitude rejected, vendor fields on a household rejected, role `admin` rejected, unknown keys rejected
- [X] T053 [P] [US3] Integration test tests/integration/auth/signup-api.test.ts: household sign-up → 201 + session cookie + `redirect_to: '/household'`; vendor sign-up → vendor row with `verification_status = 'unverified'` and radius default 25; duplicate email → 409 `CONFLICT` neutral message; invalid body → 400 with field `details`; bypass attempts directly against the identity service with the anon key — metadata `role: 'admin'` fails, vendor without `company_name` fails, metadata `is_demo: true` yields `is_demo = false`
- [X] T054 [P] [US3] E2E test tests/e2e/signup-signin.spec.ts: vendor sign-up form reveals vendor fields only when Vendor is selected; successful household sign-up lands on `/household`; sign out and sign in again lands on `/household`; wrong password shows "Email or password is incorrect."; reload keeps session

### Implementation for User Story 3

- [X] T055 [P] [US3] Add `signUpSchema` (strict, discriminated on `role`; rules exactly as contracts/auth-api.md) and `signInSchema` (`email`, `password` 1–72) to src/lib/validation/auth.ts
- [X] T056 [US3] Implement `POST` in src/app/api/auth/signup/route.ts: `assertSameOrigin`; `CONFLICT` "Already signed in" when a session exists; parse `signUpSchema`; `auth.signUp` with metadata via the cookie server client; map "already registered" to `CONFLICT` with the neutral message and trigger exceptions to `VALIDATION_FAILED`; return 201 `{ profile, redirect_to }`; `logEvent('auth.signup', { userId, role })`
- [X] T057 [US3] Build src/app/signup/page.tsx and src/app/signup/sign-up-form.tsx: role radio group (Household / Vendor), labelled fields, vendor fields shown when Vendor selected, client-side `signUpSchema` validation, server `details` mapped to FieldError per field, submitting state, signed-in visitors see "You're signed in as … — sign out first"
- [X] T058 [P] [US3] Build src/app/login/page.tsx and src/app/login/sign-in-form.tsx: browser `signInWithPassword`, then `GET /api/me`, then `router.replace(safeNextPath(next, role))`; every auth error shows "Email or password is incorrect."; links to sign-up and demo buttons
- [X] T059 [US3] Add `redirectIfSignedIn()` to src/lib/api/auth-guard.ts and use it in src/app/login/page.tsx so signed-in users are sent to their role home

**Checkpoint**: Sign-up and sign-in work for both roles; T052–T054 pass.

---

## Phase 6: User Story 4 - View and update my own profile (Priority: P3)

**Goal**: `/account` page for viewing/editing own profile and vendor business details.

**Independent Test**: As a demo vendor change radius to 35 and save; reload shows 35; radius 900 shows a field error.

### Tests for User Story 4 (write first)

- [X] T060 [P] [US4] Unit test tests/unit/validation/profile.test.ts: `profileUpdateSchema` (name 1–100, phone or null, at least one field, unknown keys incl. `role`, `is_demo`, `email` rejected) and `vendorProfileUpdateSchema` (`company_name` 2–120, `service_area` 2–200, `service_radius_km` 1–500, lat/lng both-or-neither, `verification_status` rejected)
- [X] T061 [P] [US4] Integration test tests/integration/auth/me-update-api.test.ts for `PATCH /api/me`: household updates name/phone → 200; vendor updates radius/company → 200 and persisted; household sending `company_name` → 400; body with `role` or `verification_status` → 400; no token → 401; cookie request with foreign Origin → 403; user A's PATCH never changes user B's rows

### Implementation for User Story 4

- [X] T062 [P] [US4] Create `profileUpdateSchema` and `vendorProfileUpdateSchema` in src/lib/validation/profile.ts per contracts/me-api.md
- [X] T063 [US4] Implement `PATCH` in src/app/api/me/route.ts: `requireUser`, `assertSameOrigin`, choose schema by role, update `profiles` / `vendors` rows of `auth.uid()` with the RLS-bound client, return updated `Me`
- [X] T064 [US4] Build src/app/account/page.tsx and src/app/account/profile-form.tsx: read-only email, role and Demo label; editable name/phone (+ vendor fields; verification status shown read-only as "Unverified"/"Demo", never "Verified"); loading, field-error, success toast and error states
- [X] T065 [US4] Add the "Account" (`/account`) entry to src/components/layout/user-menu.tsx

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T066 [P] Accessibility pass on src/app/login/sign-in-form.tsx, src/app/signup/sign-up-form.tsx and src/app/account/profile-form.tsx: every input has a visible `<label>`, errors linked via `aria-describedby`, focus moves to the first invalid field on submit, all controls keyboard operable
- [X] T067 [P] Add tests/e2e/responsive-a11y.spec.ts: at 360 px `/`, `/login`, `/signup`, `/account` have `scrollWidth <= innerWidth`; `@axe-core/playwright` reports no `color-contrast` or `label` violations; adjust tokens in src/app/globals.css if needed
- [ ] T068 Run every step of specs/001-platform-foundation-auth/quickstart.md and fix any gap found — *Open: rows 1–15 and 17–18 are covered by the automated suites; row 16 (stop Supabase, click a demo button) still needs a manual run.*
- [X] T069 Using the scripts in package.json, run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` and record results in the task notes — *Result 2026-11-01: lint clean · typecheck clean · unit 60/60 · integration 35 passed + demo-disabled case passed against a DEMO_ACCOUNTS_ENABLED=false server · build OK · e2e 24/24 (desktop + 360 px).*

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (T001–T009) → Foundational (T010–T034) → User stories → Polish.
- Within Foundational: T013–T015 → T016 → T017; T020–T021 before T028; T022 → T023 → T024 → T025 (same migration file) → T026 → T027; T028 → T029; T030–T031 → T032.
- **All later features (002–011) depend on Phase 2 being complete.**

### User Story Dependencies

- US1 (P1): after Foundational. No story dependencies.
- US2 (P1): after Foundational; its e2e (T048) uses the demo buttons from US1 (T040).
- US3 (P2): after Foundational; T058 uses `GET /api/me` from US2 (T050).
- US4 (P3): after US2 (extends src/app/api/me/route.ts).

### Parallel Opportunities

- Setup: T003–T009 in parallel after T001–T002.
- Foundational: T010–T015, T018–T020 in parallel; T030, T031, T033, T034 in parallel.
- US1 tests T035–T036 together; T037, T038, T043 together.
- US2 tests T045–T049 all in parallel.
- US3 tests T052–T054 together; T055 and T058 in parallel.

## Parallel Example: User Story 2

```bash
Task: "Integration test RLS in tests/integration/auth/rls-profiles-vendors.test.ts"
Task: "Integration test GET /api/me in tests/integration/auth/me-api.test.ts"
Task: "Unit test auth guard in tests/unit/api/auth-guard.test.ts"
Task: "E2E role routing in tests/e2e/role-routing.spec.ts"
Task: "Bundle secrets scan in tests/integration/security/client-bundle-secrets.test.ts"
```

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 (unblocks every feature team — do this in the first ~30 minutes).
2. US1 (demo path) → validate with T035/T036 → teams 002/004 can start.
3. US2 → authorization suites green.
4. US3, then US4 if time permits.

### Parallel Team Strategy

- Member 1: T001–T009, T022–T027 (schema + seed), T028–T029.
- Member 2: T009, T030–T033, then US1 UI (T040–T043).
- Member 3: T013–T021, then US2 tests.
- Member 4: T034 helpers, then US3.

## Requirement Coverage

| Requirement | Tasks |
|---|---|
| FR-001 Landing page content | T041, T036 |
| FR-002 Visual identity, AA contrast | T009, T031, T067 |
| FR-003 Mobile-first, 360 px | T032, T041, T067 |
| FR-004 App shell | T032, T042, T043, T065 |
| FR-005 Sign-up fields and role | T055, T056, T057, T052 |
| FR-006 Vendor sign-up fields | T055, T024, T057, T052, T053 |
| FR-007 Server validation, strict, field details | T017, T055, T056, T062, T052, T060 |
| FR-008 Only household/vendor; role immutable | T022, T024, T025, T045, T053 |
| FR-009 Verification `unverified`/`demo`, immutable | T023, T024, T025, T026, T045, T064 |
| FR-010 Duplicate email neutral message | T056, T053 |
| FR-011 Sign-in with generic failure | T058, T054 |
| FR-012 Role routing + safe return-to | T019, T012, T039, T056, T058, T048 |
| FR-013 Session persistence + sign-out | T021, T029, T032, T036, T054 |
| FR-014 Four demo accounts, one click | T026, T037, T039, T040, T035 |
| FR-015 Demo labels, never verified | T031, T032, T040, T041, T064, T036 |
| FR-016 Demo creds server-only; toggle | T015, T037, T039, T041, T035, T049 |
| FR-017 Demo reset + extensible seed | T002, T026 |
| FR-018 Anonymous redirect + return | T029, T028, T048 |
| FR-019 Cross-role page refusal | T028, T042, T043, T048 |
| FR-020 Server identity/role/ownership checks | T028, T047, T046, T050 |
| FR-021 Data-layer access rules | T025, T045 |
| FR-022 Cross-site mutation refusal | T028, T047, T035, T061 |
| FR-023 Secrets server-only | T015, T020, T049 |
| FR-024 Safe logging | T018, T044, T051, T056 |
| FR-025 Own profile view/update | T062, T063, T064, T065, T060, T061 |
| FR-026 Response envelope + codes | T016, T017, T010, T011 |
| FR-027 No internal detail in errors | T016, T010, T030 |
| FR-028 Shared vocabulary defined once | T013 |
| FR-029 Loading/empty/success/error states | T030, T033, T040, T041, T057, T064 |
| FR-030 Labelled, keyboard-operable forms | T030, T066, T067 |
| FR-031 English, reassuring copy, no guarantees | T032, T041 |
