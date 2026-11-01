# Research: Platform Foundation and Authentication

All Technical Context items were known from overview §10 and the constitution; no
NEEDS CLARIFICATION remained. The decisions below resolve the design choices this feature had
to make.

## R-01 Application scaffold

- **Decision**: Bootstrap with `create-next-app` (TypeScript, App Router, Tailwind, ESLint,
  `src/` directory, `@/*` alias), then `shadcn` init with the "new-york" style and CSS variables.
  `tsconfig.json` keeps `strict: true`.
- **Rationale**: Fixed stack (constitution "Technology and Architecture Standards"); generators
  remove 20+ minutes of manual config.
- **Alternatives considered**: Hand-written config (slower, error-prone); Vite + separate API
  (violates "one Next.js app", VIII).

## R-02 Session handling with Supabase in Next.js

- **Decision**: Use `@supabase/ssr` with cookie-based sessions. `src/lib/supabase/server.ts`
  builds a per-request client from `cookies()`; `src/middleware.ts` calls `updateSession()` to
  refresh tokens on every navigation. If the installed Next.js major renames middleware to
  `proxy.ts`, the same helper is used from `src/proxy.ts` — behaviour is unchanged.
- **Rationale**: Official Supabase pattern for App Router; server components and Route Handlers
  can read the user without client round-trips; RLS applies because the client uses the user's
  JWT and the anon key.
- **Alternatives considered**: `localStorage` sessions (server cannot see them; breaks
  server-side guards); custom JWT handling (needless risk).

## R-03 Bearer-token fallback in the server client

- **Decision**: `createServerSupabase(request)` uses an `Authorization: Bearer <access_token>`
  header when present, otherwise cookies. Same-origin enforcement (R-08) applies only to
  cookie-authenticated mutations.
- **Rationale**: Integration tests (and every later feature's authorization tests) can call the
  running app with a token obtained via `signInAs()` without browser cookies. Bearer headers are
  never sent automatically cross-site, so they add no CSRF exposure.
- **Alternatives considered**: Mocking `next/headers` in Vitest (brittle, does not exercise the
  real handler); testing only via Playwright (slow, too coarse for authorization matrices).

## R-04 Where sign-up, sign-in and demo sign-in run

- **Decision**:
  - **Sign-in / sign-out**: browser Supabase client (`signInWithPassword`, `signOut`), then
    `GET /api/me` to learn the role and route via `homePathForRole()` / `safeNextPath()`.
  - **Sign-up**: `POST /api/auth/signup` Route Handler (Zod `signUpSchema`), which calls
    `auth.signUp` with `name`, `phone`, `role` and vendor fields in user metadata, using the
    cookie-writing server client so the session is set.
  - **Demo sign-in**: `POST /api/auth/demo` Route Handler; it maps a demo key to an email and
    signs in with `DEMO_ACCOUNT_PASSWORD` server-side.
- **Rationale**: Matches overview §5 (browser → Auth for sign-in). Sign-up needs server-side
  validation of role and vendor fields (constitution III) and consistent field errors. Demo
  sign-in must keep the password server-only (FR-016). Keeping normal sign-in in the browser
  avoids all users sharing the server's IP against Supabase Auth's per-IP rate limits.
- **Alternatives considered**: All auth through Route Handlers (shared-IP rate-limit risk,
  more code); demo password embedded in landing page (violates FR-016); demo via magic link
  generation with the admin API (more moving parts).

## R-05 Creating profile and vendor rows atomically

- **Decision**: An `AFTER INSERT ON auth.users` trigger function `public.handle_new_user()`
  (`SECURITY DEFINER`, `search_path = ''`) reads `raw_user_meta_data` and inserts `profiles` and,
  for vendors, `vendors`. It raises an exception (aborting sign-up) if `role` is not
  `household`/`vendor` or required vendor fields are missing. It ignores any client-supplied
  `is_demo` or `verification_status`.
- **Rationale**: Account and profile are created in one transaction (no orphaned accounts); the
  role is validated at the data layer even if someone calls the identity service directly with
  the public anon key (FR-008).
- **Alternatives considered**: Inserting the profile from the Route Handler after sign-up
  (non-atomic, bypassable); storing role only in `user_metadata` (user-editable, untrusted).

## R-06 Immutable role, demo flag and verification status

- **Decision**: `BEFORE UPDATE` guard triggers on `profiles` (`role`, `is_demo`, `id` immutable)
  and `vendors` (`user_id`, `verification_status` immutable) that raise unless the current
  database role is `service_role`/`postgres` (seed and admin). Authenticated users may update
  only their own rows via RLS.
- **Rationale**: Simple, explicit and testable; column-level grants are easy to forget when
  later features add columns.
- **Alternatives considered**: Column-level `GRANT UPDATE (...)` (works but silently breaks
  `upsert`s and is less visible); application-only checks (violates IV).

## R-07 Role-based routing and safe redirects

- **Decision**: Three layers. (1) Middleware: anonymous requests to `/household`, `/vendor`,
  `/account` → `/login?next=<path>`. (2) `src/app/household/layout.tsx` and
  `src/app/vendor/layout.tsx` call `requirePageRole()` which redirects a wrong-role user to their
  own home. (3) Route Handlers call `requireRole()`. `safeNextPath(next, role)` accepts only
  paths starting with a single `/` and with the user's role prefix (or `/account`), otherwise
  returns `homePathForRole(role)`.
- **Rationale**: Middleware avoids flashes of protected UI; the layout check needs the DB role
  (not available cheaply in middleware); handlers are the real security boundary (IV).
- **Alternatives considered**: Role in JWT custom claims via an auth hook (extra Supabase
  configuration for little gain in the MVP).

## R-08 Cross-site request protection

- **Decision**: `assertSameOrigin(request)` rejects `POST`/`PATCH`/`DELETE` requests that are
  cookie-authenticated and whose `Origin` header is absent or differs from the app origin
  (`FORBIDDEN`). Supabase cookies are `SameSite=Lax` by default as a second layer.
- **Rationale**: Route Handlers accept JSON with cookie auth; a cheap origin check closes CSRF
  (FR-022).
- **Alternatives considered**: CSRF tokens (more plumbing for the same protection).

## R-09 Error envelope and handler wrapper

- **Decision**: `withApiHandler(fn)` wraps every handler: catches `ApiError` → its code/status;
  `ZodError` → `VALIDATION_FAILED` with `details: [{ path, message }]`; JSON parse errors →
  `VALIDATION_FAILED`; anything else → logged by event name only and returned as `INTERNAL`
  "Something went wrong. Please try again." Postgres errors are mapped by SQLSTATE where
  meaningful (`23505` unique → `CONFLICT`, `42501`/RLS → `FORBIDDEN` or `NOT_FOUND` per caller)
  and never echoed.
- **Rationale**: One place guarantees FR-026/FR-027 for every later feature.
- **Alternatives considered**: Per-handler try/catch (inconsistent, leaks easily).

## R-10 Demo accounts and seed

- **Decision**: `supabase/seed.sql` inserts four `auth.users` rows (plus matching
  `auth.identities` rows for the email provider) with fixed UUIDs and bcrypt-hashed passwords via
  `crypt(<demo password>, gen_salt('bf'))`, letting the trigger create profiles/vendors, then
  updates `profiles.is_demo = true` and `vendors.verification_status = 'demo'`. Demo emails use
  the reserved `example.com` domain. The literal demo password in `seed.sql` must equal
  `DEMO_ACCOUNT_PASSWORD`. `supabase db reset` (`npm run db:reset`) recreates everything (FR-017).
  For a hosted project, the same seed is run once via the SQL editor or `supabase db push`
  + seed.

  | Key | UUID | Email | Profile name | Vendor company | Base (lat, lng) | Radius |
  |---|---|---|---|---|---|---|
  | `household` | `d0000000-0000-4000-8000-000000000001` | `demo-household@example.com` | Sharma Residence | — | — | — |
  | `sunrise-energy` | `d0000000-0000-4000-8000-000000000011` | `demo-sunrise@example.com` | SunRise Energy | SunRise Energy | 17.4483, 78.3915 | 30 km |
  | `greenvolt-solar` | `d0000000-0000-4000-8000-000000000012` | `demo-greenvolt@example.com` | GreenVolt Solar | GreenVolt Solar | 17.4399, 78.4983 | 25 km |
  | `solartech-solutions` | `d0000000-0000-4000-8000-000000000013` | `demo-solartech@example.com` | SolarTech Solutions | SolarTech Solutions | 17.4401, 78.3489 | 40 km |

  Vendor row UUIDs: `d0000000-0000-4000-8000-000000000111` / `…112` / `…113`. Service area text:
  "Hyderabad, Telangana". Phones are fictional (`+919000000001` … `+919000000013`).
- **Rationale**: Fixed UUIDs let 004–009 append demo requests/quotes that reference these
  accounts. The demo password is not a meaningful secret (fictional accounts, already one click
  away) but is still kept out of the browser bundle per FR-016.
- **Alternatives considered**: A Node seed script using `auth.admin.createUser` (adds a
  `scripts/` tool and a second seed path; overview §6 names `seed.sql`).

## R-11 Visual identity tokens

- **Decision**: Define shadcn CSS variables in `src/app/globals.css`:
  primary deep forest green `#14532D`, accent solar green `#22A55B`, mint `#E3F6EC`, background
  warm off-white `#FAF8F3`, highlight solar yellow `#F5B700` (used only for small highlights,
  never for body text on white), foreground `#0F1F17`, destructive `#B42318`. Inter via
  `next/font/google`. Primary-on-white and white-on-primary both exceed 4.5:1.
- **Rationale**: Plan §7 palette with WCAG AA (FR-002).
- **Alternatives considered**: Geist (equally allowed; Inter chosen for broad Latin + numerals
  readability on low-end Android).

## R-12 Test strategy

- **Decision**: Vitest `unit` project (pure modules, no network) and `integration` project
  (requires `supabase start` + `npm run dev`; uses `tests/helpers/`). Playwright e2e with
  `webServer: npm run dev`. Integration tests create throw-away users via the admin client and
  delete them afterwards. A post-build test scans `.next/static/**` for the service-role key and
  demo password values (SC-004).
- **Rationale**: Constitution VI requires authorization tests; real RLS can only be proven
  against a real Postgres.
- **Alternatives considered**: pgTAP for RLS (another toolchain); mocking Supabase (proves
  nothing about RLS).

## R-13 Logging

- **Decision**: `logEvent(event, fields)` writes one JSON line via `console.info`/`console.warn`
  and drops any key not in an allowlist (`userId`, `role`, `requestId`, `quoteId`, `fromStatus`,
  `toStatus`, `code`, `demoKey`, `reason`).
- **Rationale**: Constitution IV logging rule with zero dependencies; Vercel captures stdout.
- **Alternatives considered**: pino/winston (unneeded dependency for the MVP).

## R-14 Next.js 16 specifics found at implementation time

- **Decision**: (1) Turn off `cacheComponents` (and `partialPrefetching`, which requires it) in
  `next.config.ts` and use the previous caching model. (2) Use `src/proxy.ts`, because Next.js 16
  renamed Middleware to Proxy (anticipated in R-02); `src/lib/supabase/middleware.ts` keeps the
  `updateSession()` helper. (3) `getOptionalSession()` reads `cookies()` before its `try` and
  re-throws Next.js internal errors with `unstable_rethrow`, so session pages are never prerendered.
- **Rationale**: With Cache Components, reading `cookies()` outside `<Suspense>` is a build error,
  and every SURYAMIT page reads the session. Turning it off keeps all 11 features simple
  (constitution VIII). Catching the internal dynamic-rendering error had made `/household`,
  `/vendor`, `/account` and `/` static at build time. That is now fixed, and the build output
  shows them as dynamic (ƒ).
- **Alternatives considered**: Keeping Cache Components with `<Suspense>` around every
  session read (more code in every feature for no MVP benefit); `export const dynamic =
  "force-dynamic"` on each page (easy to forget in later features).
