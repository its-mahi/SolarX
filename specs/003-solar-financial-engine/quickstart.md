# Quickstart: Solar Financial Engine (003)

Validation guide only. Contracts: [contracts/](contracts/) · Data: [data-model.md](data-model.md).

## Prerequisites

- Feature 001 complete: app runs, Supabase local stack, demo accounts, `src/lib/api/` envelope and
  auth guard, Vitest + Playwright configured.
- Feature 002 provides `household_requests` (migration applied), the wizard, dashboard and the
  `RequestEstimateSlot`. Create the demo request live as the demo household
  ("Sharma Residence (Demo)"): 250 units/month, budget ₹1,50,000, preferred 3 kW.
- **Before the demo**: verify every rule in `src/config/rules/pm-surya-ghar.v1.ts` against
  https://pmsuryaghar.gov.in/ and https://mnre.gov.in/; record `retrievedOn`, `effectiveDate`,
  source title/URL; switch `verification` to `verified` only for values actually confirmed.

## Run

```bash
npx supabase start            # local Postgres/Auth
npx supabase db reset         # applies migrations incl. 20261101000300_solar_estimates.sql + seed
npm run dev                   # http://localhost:3000
```

## Automated checks

```bash
npm run test -- tests/unit/financial tests/unit/config/rules.test.ts tests/unit/validation/solar.test.ts
npm run test -- tests/integration/api/solar-calculate.test.ts tests/integration/api/rules.test.ts tests/integration/rls/solar-estimates.test.ts
npx playwright test tests/e2e/financial-estimate.spec.ts
npm run lint && npm run typecheck
```

## Manual acceptance walkthrough

| # | Scenario (spec) | Steps | Expected |
|---|---|---|---|
| 1 | US1-1, US1-2, US1-4 | Sign in as demo household → dashboard | Estimate card: 3 kW (recommended 2.5 kW, basis "preferred"), cost ₹1,80,000, subsidy ₹78,000, net ₹1,02,000, generation 4,200 kWh, savings ≈ ₹24,360/yr, payback ≈ 4.2 yrs; each marked "Estimate"; assumptions list; version `pm-surya-ghar.v1`; "Illustrative" marker; disclaimer; "Upfront cost exceeds budget" note |
| 2 | US1-5 | Edit draft (002) to 400 units/month, remove preferred capacity → return | Card recalculates: recommended 3.5 kW used; subsidy still ₹78,000 |
| 3 | US1-3, edge | Set 30 units/month | Capacity 1 kW with "raised to minimum" note |
| 4 | US1-7 | New draft without units | Empty state "Enter your monthly consumption…" |
| 5 | US1-8 | Sign in as demo vendor; `POST /api/solar/calculate` with the household's requestId (browser devtools) | 403 `FORBIDDEN` |
| 6 | US1-8 | Second household account → same call | 404 `NOT_FOUND` |
| 7 | US2-1..3 | Sign out → open `/rules` | All rules with metadata, "Pending verification" retrieval dates, illustrative badges, CFA table 1/1.5/2/2.5/3/5 kW → 30k/45k/60k/69k/78k/78k, official links, disclaimer |
| 8 | US3-1..3 | Dashboard → What-if → 2 kW, then 5 kW → reload | 2 kW subsidy ₹60,000; 5 kW ₹78,000 + "no extra central subsidy above 3 kW"; "Preview — not saved"; after reload the saved 3 kW estimate shows |
| 9 | Edge | `POST /api/solar/calculate {"inputs":{"monthlyUnits":250},"capacityOverrideKw":-1}` | 400 `VALIDATION_FAILED` |
| 10 | US1-6 | Unit test only (zero savings) | `paybackYears: null`, card text "Not applicable" |

## Done when

All automated checks pass, all rows above pass, and the rules page shows no rule without a source
title/URL.
