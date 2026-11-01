# Quickstart: Platform Foundation and Authentication

Validation guide for feature 001. Contracts: [contracts/](contracts/). Data:
[data-model.md](data-model.md).

## Prerequisites

- Node.js 20 LTS or newer, npm
- Docker (for the local Supabase stack) and the Supabase CLI
- Playwright browsers (`npx playwright install chromium`)

## Setup

1. `npm install`
2. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     (printed by `supabase start`)
   - `DEMO_ACCOUNTS_ENABLED=true`
   - `DEMO_ACCOUNT_PASSWORD` = the demo password used in `supabase/seed.sql`
3. `supabase start`
4. `npm run db:reset` — applies `supabase/migrations/*` and `supabase/seed.sql`
5. `npm run dev` → http://localhost:3000

## Manual acceptance walkthrough

| # | Steps | Expected | Spec ref |
|---|---|---|---|
| 1 | Open `/` signed out | SURYAMIT name, core promise, 4-step "How it works", household and vendor entry points, sign-in/up links, four demo buttons with "Fictional demo data" note | US1-1, FR-001 |
| 2 | Click "Try as demo household" | Arrive at `/household`; header shows "Sharma Residence", "Household", **Demo** badge | US1-2, US1-4 |
| 3 | User menu → Sign out; press browser Back | Landing page; Back shows landing/login, never protected content | US1-5 |
| 4 | Click "Demo vendor — GreenVolt Solar" | Arrive at `/vendor` with Demo badge | US1-3 |
| 5 | As the vendor, open `/household` | Redirected to `/vendor` | US2-3 |
| 6 | Sign out, open `/vendor/anything` | Redirected to `/login?next=/vendor/anything`; after signing in as a demo vendor you land on `/vendor/anything` (or `/vendor` if that page does not exist yet, showing not-found) | US2-1 |
| 7 | Open `/login?next=https://evil.example` and sign in | Land on your role home | US2-8 |
| 8 | Sign up as Household with valid data | Land on `/household`, name shown in header, no Demo badge | US3-1 |
| 9 | Sign up as Vendor without company name; then with short password | Field errors next to each field; no account created | US3-3 |
| 10 | Sign up as Vendor with company + service area | Land on `/vendor`; `/account` shows verification "Unverified" | US3-2 |
| 11 | Sign up again with the same email | Neutral "couldn't create an account… please sign in" message | US3-4 |
| 12 | Sign in with a wrong password | "Email or password is incorrect." | US3-6 |
| 13 | Reload and open a new tab | Still signed in | US3-7 |
| 14 | `/account` as demo vendor: change radius to 35, save, reload | 35 shown; change to 900 → field error | US4-2, US4-3 |
| 15 | Set `DEMO_ACCOUNTS_ENABLED=false`, restart | No demo buttons; `POST /api/auth/demo` → 404 `NOT_FOUND` envelope | US1-6 |
| 16 | Stop Supabase (`supabase stop`) and click a demo button | Friendly error with retry, landing still usable | US1-7 |
| 17 | DevTools at 360 px width on `/`, `/login`, `/signup`, `/account` | No horizontal scroll; all controls reachable with Tab, visible focus ring | FR-003, FR-030 |
| 18 | `curl -X GET localhost:3000/api/me` without a session | `401 { "error": { "code": "UNAUTHENTICATED", … } }` | US2-4, FR-026 |

## Automated tests

```bash
npm run lint && npm run typecheck
npm run test:unit                 # errors/respond envelope, redirects, validation schemas
npm run test:integration          # needs `supabase start` + `npm run dev`: RLS on profiles/vendors, auth + me APIs
npm run build && npx vitest run tests/integration/security/client-bundle-secrets.test.ts   # SC-004
npm run test:e2e                  # Playwright: demo sign-in, role routing, sign-up/sign-in
```

Expected: all green. Integration tests create and delete their own throw-away users; demo
accounts are left untouched (re-run `npm run db:reset` to restore them if needed).
