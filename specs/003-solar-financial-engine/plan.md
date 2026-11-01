# Implementation Plan: Solar Financial Engine

**Branch**: `003-solar-financial-engine` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-solar-financial-engine/spec.md`

## Summary

Deliver the deterministic financial engine: a versioned, sourced rule set
(`src/config/rules/pm-surya-ghar.v1.ts`) and pure functions in `src/lib/domain/financial/` for
capacity recommendation, central CFA (illustrative baseline ₹30,000/kW ×2 + ₹18,000/kW ×1, cap
₹78,000), net cost, annual generation, savings with a self-consumption share and export rate, and
payback (`null` for zero savings). `POST /api/solar/calculate` computes and upserts one
`solar_estimates` row per request (or returns an unsaved preview); `GET /api/rules` and the public
`/rules` page expose rules with full source metadata; `EstimateCard` (hosted by 002) shows the
estimate with assumptions, rule version, source link and disclaimer. Illustrative placeholders
(1,400 kWh/kW/yr, ₹60,000/kW, ₹7/kWh, 70% self-consumption, ₹3/kWh export) are justified in
[research.md](research.md) and must be verified before the demo.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js LTS runtime on Vercel

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Zod, Tailwind CSS,
shadcn/ui, Lucide, `@supabase/supabase-js` / `@supabase/ssr` (all from 001). **No new dependency.**

**Storage**: Supabase PostgreSQL — new table `solar_estimates` (RLS). Rules live in code, not DB.

**Testing**: Vitest (unit + integration against local Supabase), Playwright (one e2e check)

**Target Platform**: Web (mobile-first), Vercel + Supabase

**Project Type**: Single Next.js web application (UI + Route Handlers)

**Performance Goals**: Calculation < 5 ms in-process; estimate visible < 2 s after opening the
dashboard (SC-004)

**Constraints**: Domain functions pure (no I/O, no framework imports); money integer INR;
capacity kW decimal; energy kWh; no AI in any calculation

**Scale/Scope**: Hackathon demo (1–10 households); 10 rules; 2 endpoints; 1 page; 3 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Complete Workflow First | PASS | P0 feature; no AI dependency; the card degrades to an empty/error state and never blocks the request flow |
| II | Deterministic Core, Advisory AI | PASS | All numbers from pure functions in `src/lib/domain/financial/`; no AI call anywhere in this feature |
| III | Untrusted Input & Injection Resistance | PASS | Every body validated with a strict Zod schema on the server; no AI or free text involved |
| IV | Security & Privacy by Default | PASS | Household role + ownership check in the route; RLS select-only for owners; writes only via server admin client after authorization; logs carry ids only |
| V | Transparent, Sourced Estimates | PASS | One versioned rule config with full metadata per rule; card shows assumptions, version, source, disclaimer; CFA baseline and D-06 placeholders marked illustrative |
| VI | Targeted Mandatory Testing | PASS | Unit tests for every plan §18 financial case + validation; integration authz/RLS tests; e2e visibility check |
| VII | Graceful Degradation | PASS | Loading/empty/success/error states for card and rules page; shared error envelope; no leaked internals |
| VIII | Hackathon-Scale Simplicity | PASS | No new dependency; rules as a TS module; recompute-on-view instead of triggers/queues |

**Post-design re-check (after Phase 1)**: PASS on all eight. The design adds no table beyond
overview §7, no endpoint beyond overview §8, and no dependency.

## Project Structure

### Documentation (this feature)

```text
specs/003-solar-financial-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── solar-calculate.md
│   └── rules.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── config/rules/
│   ├── types.ts                         # Rule, RuleSet, RuleKey types
│   ├── pm-surya-ghar.v1.ts              # versioned rule set (illustrative values + metadata)
│   └── index.ts                         # activeRuleSet export
├── lib/domain/financial/
│   ├── errors.ts                        # FinancialInputError
│   ├── cfa.ts                           # calculateCentralCfa
│   ├── net-cost.ts                      # calculateNetCost
│   ├── capacity.ts                      # recommendCapacityKw, chooseEstimateCapacity
│   ├── generation.ts                    # estimateAnnualGenerationKwh
│   ├── tariff.ts                        # resolveTariff
│   ├── savings.ts                       # estimateAnnualSavings
│   ├── payback.ts                       # calculateSimplePaybackYears
│   ├── estimate.ts                      # buildSolarEstimate (composition, rounding, notes)
│   └── index.ts                         # public exports (used by 006, 011)
├── lib/validation/
│   ├── solar.ts                         # calculateRequestSchema, estimate response + assumptions schemas
│   └── rules.ts                         # ruleSetSchema
├── app/
│   ├── api/solar/calculate/route.ts     # POST
│   ├── api/rules/route.ts               # GET (public)
│   └── rules/
│       ├── page.tsx                     # public rules & sources page
│       ├── loading.tsx
│       └── error.tsx
└── components/
    ├── shared/
    │   ├── estimate-card.tsx            # EstimateCard (variants review | detail | card)
    │   ├── estimate-badge.tsx           # EstimateBadge (reused by 006)
    │   ├── what-if-capacity.tsx         # WhatIfCapacity control
    │   └── rules-table.tsx              # RulesTable used by /rules
    └── household/extension-slots.tsx    # MODIFIED (002-owned): body of RequestEstimateSlot only

supabase/migrations/20261101000300_solar_estimates.sql

tests/
├── unit/financial/{cfa,net-cost,capacity,generation,tariff,savings,payback,estimate}.test.ts
├── unit/config/rules.test.ts
├── unit/validation/solar.test.ts
├── integration/api/solar-calculate.test.ts
├── integration/api/rules.test.ts
├── integration/rls/solar-estimates.test.ts
└── e2e/financial-estimate.spec.ts
```

**Structure Decision**: Single Next.js app per overview §6. Domain code in
`src/lib/domain/financial/`, rules in `src/config/rules/`, public page at `src/app/rules/`.
Shared UI goes in `src/components/shared/` because both 002 (dashboard, wizard) and 006 (estimate
vs vendor-confirmed badge) consume it. 003 does not edit 002's pages; it only fills the body of
002's `RequestEstimateSlot` (stable props `request`, `variant`) to render `EstimateCard`.

## Phase outputs

- Phase 0: [research.md](research.md) — R-01..R-15 (placeholder values R-05..R-08).
- Phase 1: [data-model.md](data-model.md), [contracts/solar-calculate.md](contracts/solar-calculate.md),
  [contracts/rules.md](contracts/rules.md) (API + UI contracts), [quickstart.md](quickstart.md).

## Complexity Tracking

Not needed — no violations.
