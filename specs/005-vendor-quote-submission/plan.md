# Implementation Plan: Vendor Quote Submission

**Branch**: `005-vendor-quote-submission` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-vendor-quote-submission/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Vendors submit structured quotes on `open`/`quoted` requests, see their quote history and withdraw
submitted quotes. This feature creates the canonical `quotes` table (overview §7) with RLS, the
`POST /api/quotes`, `GET /api/quotes/mine` and `POST /api/quotes/:id/withdraw` endpoints, a
reusable quote form, and demo quotes for the three seed vendors.

Technical approach: every write goes through a `SECURITY DEFINER` Postgres function
(`submit_quote`, `withdraw_quote`) that checks the caller's vendor role, locks the request (or
quote) row, enforces the status rules and — for the first quote — moves the request
`open` → `quoted` in the same transaction (overview §5 rule 5). Vendors and households get
**SELECT-only** RLS policies; there are no INSERT/UPDATE/DELETE policies, so direct table writes are
impossible. A partial unique index enforces one active quote per (request, vendor) (D-02). Zod
schemas in `src/lib/validation/quote.ts` are shared by the form and the Route Handler and are split
into a reusable `quoteFieldsSchema` so feature 009 can pre-fill and extend the same form. See
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict mode); SQL (PostgreSQL 15 via Supabase)

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Tailwind CSS, shadcn/ui
(`Form`, `Input`, `Select`, `RadioGroup`, `Textarea`, `AlertDialog`, `Badge`), Lucide, Zod,
`@supabase/ssr` / `@supabase/supabase-js` (from 001), `react-hook-form` + `@hookform/resolvers`
(required by shadcn/ui `Form`; reused if 001/002 installed them, otherwise added and named here).
No other new runtime dependency.

**Storage**: Supabase PostgreSQL — new table `quotes`; reads/updates `household_requests.status`
(002) via a definer function; reads `vendors` (001). No storage bucket use (quote documents belong
to 009).

**Testing**: Vitest (unit + integration against local Supabase), Playwright (quote submission
smoke) — D-08

**Target Platform**: Web (mobile-first), Vercel + Supabase

**Project Type**: Single Next.js web application

**Performance Goals**: Submit and history responses feel instant (< 1 s) at hackathon scale

**Constraints**: All writes atomic and concurrency-safe; integer INR; no AI calls; vendor text
stored verbatim and rendered as plain text only

**Scale/Scope**: 3 demo vendors, a handful of requests, tens of quotes; 3 endpoints, 2 pages,
1 migration, 1 seed section

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Complete Workflow First | PASS | P0 quote step with no AI dependency; extraction (009) is only an optional pre-fill of the same form. |
| II. Deterministic Core, Advisory AI | PASS | Status rules (quotable statuses, open → quoted, withdrawability) are pure, unit-tested domain functions mirrored in the DB functions; no AI involvement. |
| III. Untrusted Input | PASS | Every body/param Zod-validated on the server; DB CHECK constraints backstop direct RPC calls; free text stored verbatim, rendered as plain text, never interpreted; injection-like text has a test proving no effect. |
| IV. Security and Privacy by Default | PASS | Server role/ownership checks in each handler + RLS (SELECT-only policies) + definer functions with explicit vendor guard; no write policies; vendors never see other vendors' quotes; logs carry ids and statuses only. |
| V. Transparent, Sourced Estimates | PASS (N/A) | No estimates computed; quote values are vendor-stated and labelled as such where displayed. |
| VI. Targeted Mandatory Testing | PASS | Unit: Zod schema boundaries, lifecycle rules. Integration: submit (status transition, duplicate, non-quotable, concurrency), withdraw rules, RLS cross-vendor and household isolation, seed shape. E2E smoke. |
| VII. Graceful Degradation | PASS | Loading/empty/success/error states for form, quote panel and history; errors use the shared envelope; no AI dependency to fail. |
| VIII. Hackathon-Scale Simplicity | PASS | One migration, two SQL functions, three small handlers; only shadcn's form dependencies named. |

**Post-design re-check (after Phase 1)**: PASS. Data model matches overview §7 `quotes` columns; the
extensions (definer functions, partial unique index, CHECK constraints, a history helper function)
are additive and documented in data-model.md. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/005-vendor-quote-submission/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── quotes.md        # POST /api/quotes, GET /api/quotes/mine, POST /api/quotes/:id/withdraw
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 20261101000500_quotes.sql              # NEW: quotes table, constraints, indexes, RLS, functions
└── seed.sql                                   # MODIFY: append "005 demo quotes" section

src/
├── app/
│   ├── api/quotes/
│   │   ├── route.ts                           # NEW: POST /api/quotes
│   │   ├── mine/route.ts                      # NEW: GET /api/quotes/mine
│   │   ├── [id]/withdraw/route.ts             # NEW: POST /api/quotes/:id/withdraw
│   │   └── _lib/map-quote-db-error.ts         # NEW: SQLSTATE → shared error codes
│   └── vendor/
│       ├── requests/[id]/quote/page.tsx       # NEW: quote form page
│       └── quotes/page.tsx                    # NEW: My quotes (history)
├── components/
│   ├── quotes/
│   │   ├── quote-form.tsx                     # NEW: reusable form (defaultValues, onSubmit)
│   │   ├── quote-summary.tsx                  # NEW: read-only quote display (plain text)
│   │   ├── quote-status-badge.tsx             # NEW
│   │   ├── vendor-quote-panel.tsx             # NEW: "Your active quote" or "Submit a quote" CTA
│   │   ├── withdraw-quote-dialog.tsx          # NEW: confirmation dialog
│   │   └── quote-history.tsx                  # NEW: history list with states
│   └── vendor/
│       ├── request-detail.tsx                 # MODIFY (owned by 004): render <VendorQuotePanel>
│       └── vendor-discovery.tsx               # MODIFY (owned by 004): add "My quotes" link in header
└── lib/
    ├── domain/
    │   ├── requests/quoting.ts                # NEW: isQuotableRequestStatus, requestStatusAfterQuote
    │   └── quotes/lifecycle.ts                # NEW: isActiveQuoteStatus, canWithdrawQuote
    └── validation/quote.ts                    # NEW: enums, detail schemas, quoteFieldsSchema, submission/query schemas, types

tests/
├── fixtures/quote-inputs.ts                   # NEW: valid/invalid quote payloads
├── unit/validation/quote-schema.test.ts       # NEW
├── unit/domain/requests/quoting.test.ts       # NEW
├── unit/domain/quotes/lifecycle.test.ts       # NEW
├── unit/api/map-quote-db-error.test.ts        # NEW
├── integration/quotes/
│   ├── submit-quote.test.ts                   # NEW
│   ├── my-quotes.test.ts                      # NEW
│   ├── withdraw-quote.test.ts                 # NEW
│   ├── quotes-rls.test.ts                     # NEW
│   └── demo-seed.test.ts                      # NEW
└── e2e/vendor-quote-submission.spec.ts        # NEW
```

**Structure Decision**: Single Next.js application per overview §6. Endpoints follow the overview
§8 catalogue under `src/app/api/quotes/` (`mine` is a static segment beside the `[id]` dynamic
segment, which Next.js allows; 006/007/009 later add `compare/`, `[id]/accept/` and `extract/`).
The form lives in `src/components/quotes/` (shared quotes folder) so 009 can reuse it. Reused, not
created: 001's `src/lib/api/{respond,errors,auth-guard}.ts`, `src/lib/supabase/server.ts`, base
validation schemas and vendor-area guard; 002's `household_requests`; 004's request detail page and
permitted request summary (`GET /api/requests/:id`).

### Reusability for feature 009 ("extract from document")

- `quoteFieldsSchema` (all form fields, no `request_id`, no `source`) is the single source of truth
  for quote content. 009's extraction output is validated against `quoteFieldsSchema.partial()`
  (unknown values stay `null`/absent) and passed to the form as `defaultValues`.
- `QuoteForm` props: `request` (permitted summary), `defaultValues?: Partial<QuoteFields>`,
  `origin?: 'manual' | 'ai_extracted'` (shows a "Pre-filled from your document — review every field"
  banner when `ai_extracted`), `onSubmit(values: QuoteFields)`. The form never submits on its own.
- `quoteSubmissionSchema = quoteFieldsSchema.extend({ request_id })`. 009 extends it with
  `source` and `source_document_path` and replaces `submit_quote` with a version that accepts them
  (default `manual`); 005 always writes `source = 'manual'` and `source_document_path = null`.

## Complexity Tracking

No violations; section intentionally empty.
