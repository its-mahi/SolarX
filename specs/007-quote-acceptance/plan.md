# Implementation Plan: Quote Acceptance

**Branch**: `007-quote-acceptance` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-quote-acceptance/spec.md`

## Summary

Complete the P0 flow with a confirmed, atomic, single acceptance. A SECURITY DEFINER Postgres
function `accept_quote(p_quote_id)` locks the request row, re-checks ownership and statuses, sets
the chosen quote `accepted`, other `submitted` quotes `rejected`, the request `accepted`, and
inserts `quote_acceptances` (unique `quote_id` and unique `request_id`, D-03) in one transaction;
any repeat or concurrent attempt returns `409 CONFLICT`. `POST /api/quotes/:id/accept` wraps it
behind a `{confirmed:true}` body and the UI confirmation dialog. The household sees an accepted /
next-steps panel (002's `RequestAcceptanceSlot`) and can close the request (`close_request`,
`POST /api/requests/:id/close`, D-10). Vendors see their outcome in 005's quote history and only
the accepted vendor can fetch household contact (`accepted_household_contact`,
`GET /api/quotes/:id/contact`, D-01). 007 also owns the Playwright end-to-end test of the P0 flow.

## Technical Context

**Language/Version**: TypeScript (strict); PL/pgSQL for database functions

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Zod, Tailwind CSS,
shadcn/ui (`AlertDialog`, `Dialog`), Lucide, Supabase JS (all from 001). **No new dependency.**

**Storage**: Supabase PostgreSQL — new table `quote_acceptances` (RLS) and four SECURITY DEFINER
functions; status updates on `quotes` (005) and `household_requests` (002)

**Testing**: Vitest (unit + integration against local Supabase, incl. concurrency), Playwright (P0 e2e)

**Target Platform**: Web, mobile-first; Vercel + Supabase

**Project Type**: Single Next.js web application

**Performance Goals**: Accept round trip < 1 s; accepted state visible < 2 s (SC-005)

**Constraints**: All multi-row changes in one DB transaction; request row locked before quote rows;
no PII in logs; contact data only via definer function to the accepted vendor

**Scale/Scope**: ≤ 10 quotes per request; 3 endpoints (1 listed, 2 extensions); 4 DB functions; 6 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Complete Workflow First | PASS | Final P0 step; no AI; includes the request → quote → compare → accept e2e test |
| II | Deterministic Core, Advisory AI | PASS | Acceptance and authorization are code + DB function; no AI involvement |
| III | Untrusted Input & Injection Resistance | PASS | Strict Zod bodies (`confirmed: true` literal) and uuid params; vendor text never interpreted |
| IV | Security & Privacy by Default | PASS | `requireRole` + ownership re-checked inside definer functions under lock; RLS select-only on `quote_acceptances`; contact revealed only to the accepted vendor via a column-restricted function; logs ids/statuses only |
| V | Transparent, Sourced Estimates | PASS | Confirmation dialog marks net cost as "estimate"; next steps state subsidy is not guaranteed and link the official portal |
| VI | Targeted Mandatory Testing | PASS | Race (50 iterations), withdrawn/rejected, non-owner, cascade, DB unique backstop, close, contact, RLS, e2e |
| VII | Graceful Degradation | PASS | Pending/success/error/conflict states; conflicts refresh to the true state; shared error envelope |
| VIII | Hackathon-Scale Simplicity | PASS | Plain Postgres row locks + unique constraints; no queues, no new dependency |

**Post-design re-check (after Phase 1)**: PASS on all eight. Deviations from the overview,
recorded for the overview owner (not violations): two new endpoints
(`POST /api/requests/:id/close`, `GET /api/quotes/:id/contact`) and four database functions —
see research R-06..R-08. No column added to any §7 table.

## Project Structure

### Documentation (this feature)

```text
specs/007-quote-acceptance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── acceptance.md
│   ├── request-close.md
│   └── ui-acceptance.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/migrations/20261101000700_quote_acceptances.sql   # table, RLS, accept_quote, close_request,
                                                           # accepted_household_contact, household_acceptance_summary
src/
├── lib/
│   ├── domain/requests/acceptance.ts                      # canAcceptQuote, canCloseRequest, quoteOutcomeLabel
│   └── validation/acceptance.ts                           # body/param/result schemas
├── app/api/
│   ├── quotes/[id]/accept/route.ts                        # POST
│   ├── quotes/[id]/contact/route.ts                       # GET (extension)
│   ├── quotes/_lib/map-acceptance-db-error.ts             # SQLSTATE → API error
│   ├── requests/[id]/close/route.ts                       # POST (extension)
│   └── requests/[id]/quotes/route.ts                      # MODIFIED (006): add `acceptance` field
├── components/
│   ├── quotes/
│   │   ├── accept-quote-button.tsx
│   │   ├── accept-quote-dialog.tsx
│   │   ├── quote-outcome-notice.tsx
│   │   ├── accepted-quote-contact.tsx
│   │   ├── quote-comparison-view.tsx                      # MODIFIED (006): fill actionSlot
│   │   └── quote-history.tsx                              # MODIFIED (005): outcome + contact
│   └── household/
│       ├── accepted-next-steps.tsx
│       ├── close-request-dialog.tsx
│       └── extension-slots.tsx                            # MODIFIED (002-owned): RequestAcceptanceSlot body;
│                                                          #   RequestQuotesSlot card variant accepted state
tests/
├── unit/requests/acceptance.test.ts
├── integration/acceptance/
│   ├── accept-race.test.ts
│   ├── accept-rules.test.ts
│   ├── accept-cascade.test.ts
│   ├── acceptance-summary.test.ts
│   ├── close-request.test.ts
│   └── contact-reveal.test.ts
├── integration/rls/quote-acceptances.test.ts
├── fixtures/e2e/roof-sample.jpg                           # fictional test image (if 002 has none)
└── e2e/request-quote-compare-accept.spec.ts
```

**Structure Decision**: Single Next.js app per overview §6. DB-side atomicity in the 007
migration; thin Route Handlers under `src/app/api/`; status helpers in
`src/lib/domain/requests/` (next to 002's `status.ts`); UI mounted through existing extension
points (002 slots, 006 `actionSlot`, 005 quote history) instead of new pages.

## Phase outputs

- Phase 0: [research.md](research.md) — R-01..R-13.
- Phase 1: [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Complexity Tracking

Not needed — no constitution violations. (Overview §8 extensions are documented above and in
research R-06/R-07 for the overview owner to adopt.)
