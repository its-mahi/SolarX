# Implementation Plan: Quote Comparison and Scoring

**Branch**: `006-quote-comparison-scoring` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-quote-comparison-scoring/spec.md`

## Summary

Give the owning household a side-by-side comparison of its quotes. Pure domain modules in
`src/lib/domain/quotes/` normalize each quote defensively (unknown → `null`), detect 14
recommended items, compute flags, and score from a type-restricted `ScoringInput` that contains
structured fields only (no free text can reach scoring). Weights and targets come from
`src/config/scoring.v1.ts` (price 30, technical 25, warranty 20, completeness 15, timeline 10).
Per-quote subsidy and net cost reuse 003. `POST /api/quotes/compare` recomputes and upserts
`quote_reviews`; `GET /api/requests/:id/quotes` lists normalized quotes. The comparison screen
shows cards/table, estimate vs vendor-confirmed markers, breakdowns with penalties, flags and
the "not an official rating" disclaimer, with an `actionSlot` for 007.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js LTS on Vercel

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Zod, Tailwind CSS,
shadcn/ui, Lucide, Supabase JS (from 001); `src/lib/domain/financial/` and `EstimateBadge` from 003.
**No new dependency.**

**Storage**: Supabase PostgreSQL — new table `quote_reviews` (RLS); reads `quotes`,
`household_requests`, `vendors`, `solar_estimates`

**Testing**: Vitest (unit + integration with local Supabase); e2e coverage is delivered by 007's
full-flow Playwright test

**Target Platform**: Web, mobile-first; Vercel + Supabase

**Project Type**: Single Next.js web application

**Performance Goals**: Scoring 10 quotes < 5 ms in-process; comparison screen < 2 s with 3 quotes (SC-006)

**Constraints**: Domain modules pure; scoring reads structured fields only; integer-tenths
arithmetic for scores; money integer INR

**Scale/Scope**: ≤ 10 quotes per request; 2 endpoints; 1 page; 6 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Complete Workflow First | PASS | P0 compare step; works with manual quotes and no AI |
| II | Deterministic Core, Advisory AI | PASS | Validation, missing fields, flags, scores, ranking and explanation sentence are pure code; no AI call; AI cannot set any value |
| III | Untrusted Input & Injection Resistance | PASS | `ScoringInput` type excludes all free text; per-field Zod parsing of jsonb; vendor text rendered as plain text; request bodies Zod-validated |
| IV | Security & Privacy by Default | PASS | Owner-household check in both routes; RLS select-only for owners on `quote_reviews`; writes via admin client after authorization; vendors never see reviews/scores |
| V | Transparent, Sourced Estimates | PASS | Per-quote subsidy/net cost labelled "estimate" with rule version and `/rules` link; score labelled "not an official rating" with weights and version |
| VI | Targeted Mandatory Testing | PASS | Unit tests for normalization, missing fields, flags, each sub-score, determinism, ties, single quote, free-text invariance; integration authz + RLS tests |
| VII | Graceful Degradation | PASS | Loading/empty/all-withdrawn/success/error states; malformed jsonb degrades to "Not stated"; shared error envelope |
| VIII | Hackathon-Scale Simplicity | PASS | No new dependency; recompute-on-view instead of triggers/jobs |

**Post-design re-check (after Phase 1)**: PASS on all eight. No table or endpoint beyond
overview §7/§8; per-quote estimates stored inside `normalized_fields` jsonb (no new column).

## Project Structure

### Documentation (this feature)

```text
specs/006-quote-comparison-scoring/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── request-quotes.md
│   ├── quotes-compare.md
│   └── ui-quote-comparison.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── config/scoring.v1.ts                         # weights, targets, thresholds, recommended items, disclaimer
├── lib/domain/quotes/
│   ├── types.ts                                 # NormalizedQuote, ScoringInput, Flag, ScoreBreakdown, QuoteReview
│   ├── normalize.ts                             # normalizeQuote, toScoringInput
│   ├── validate.ts                              # validateRequiredFields
│   ├── missing-fields.ts                        # detectMissingFields
│   ├── flags.ts                                 # computeFlags
│   ├── scoring.ts                               # scorePrice/Technical/Warranty/Completeness/Timeline, scoreQuotes (rank, ties)
│   ├── explanation.ts                           # buildExplanation
│   ├── compare.ts                               # compareQuotes (orchestrates all + 003 estimates)
│   └── index.ts
├── lib/validation/quote-review.ts               # per-field jsonb parsers, compare body schema, response schemas
├── app/
│   ├── api/requests/[id]/quotes/route.ts        # GET
│   ├── api/quotes/compare/route.ts              # POST
│   └── household/requests/[id]/quotes/
│       ├── page.tsx
│       ├── loading.tsx
│       └── error.tsx
└── components/quotes/
    ├── quote-comparison-view.tsx
    ├── quote-card.tsx                           # exposes actionSlot for 007
    ├── quote-comparison-table.tsx
    ├── score-breakdown.tsx
    ├── quote-flags.tsx
    └── scoring-disclaimer.tsx
src/components/household/extension-slots.tsx     # MODIFIED (002-owned): body of RequestQuotesSlot only

supabase/migrations/20261101000600_quote_reviews.sql

tests/
├── fixtures/quotes/demo-quotes.ts               # research.md R-11 values (fictional)
├── unit/config/scoring.test.ts
├── unit/quotes/{normalize,validate,missing-fields,flags,scoring,ranking,compare,explanation}.test.ts
├── integration/api/request-quotes.test.ts
├── integration/api/quotes-compare.test.ts
└── integration/rls/quote-reviews.test.ts
```

**Structure Decision**: Single Next.js app per overview §6. Domain logic in
`src/lib/domain/quotes/`, weights in `src/config/scoring.v1.ts`, comparison UI in
`src/components/quotes/` and the household route `src/app/household/requests/[id]/quotes/`.
The GET route nests under 002's `src/app/api/requests/[id]/` folder as a new sub-route without
modifying 002's files. The dashboard card and request page reach the comparison through 002's
`RequestQuotesSlot` (stable props `request`, `variant`); 006 fills only that slot body.

## Phase outputs

- Phase 0: [research.md](research.md) — R-01..R-12 (formulas R-04, worked example R-11).
- Phase 1: [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Complexity Tracking

Not needed — no violations.
