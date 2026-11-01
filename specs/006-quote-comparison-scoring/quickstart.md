# Quickstart: Quote Comparison and Scoring (006)

Validation guide only. Contracts: [contracts/](contracts/) · Data: [data-model.md](data-model.md) ·
Formulas and expected demo values: [research.md](research.md) R-04, R-11.

## Prerequisites

- 001 (auth, demo accounts, envelope), 002 (demo request "Sharma Residence (Demo)", budget
  ₹1,50,000, preferred 3 kW), 003 (`src/lib/domain/financial/`, `EstimateBadge`), 005 (`quotes`
  table, quote submission, withdraw) implemented and migrated.
- The three demo vendors have submitted the demo quotes in research.md R-11 (via 005's form or
  `supabase/seed.sql`).

## Run

```bash
npx supabase start
npx supabase db reset          # includes 20261101000600_quote_reviews.sql
npm run dev
```

## Automated checks

```bash
npm run test -- tests/unit/quotes tests/unit/config/scoring.test.ts
npm run test -- tests/integration/api/request-quotes.test.ts tests/integration/api/quotes-compare.test.ts tests/integration/rls/quote-reviews.test.ts
npm run lint && npm run typecheck
```

## Manual acceptance walkthrough

| # | Scenario (spec) | Steps | Expected |
|---|---|---|---|
| 1 | US1-1, US1-2 | Demo household → request → "Compare quotes" | 3 cards, same fields/order; SunRise price ₹1,65,000 "vendor-confirmed", 3.3 kW, ₹50,000/kW, subsidy ₹78,000 & net ₹87,000 "estimate" |
| 2 | US1-3 | Inspect GreenVolt | Workmanship warranty and earthing read "Not stated"; all other fields shown |
| 3 | US2-1, US2-4 | Inspect flags | GreenVolt: 2 missing items ("Earthing: not stated", workmanship warranty); SunRise: "All recommended details provided" + "Above your budget" (info) |
| 4 | US3-1, US3-6 | Read scores | SolarTech 94.8 (1), SunRise 94.3 (2), GreenVolt 83.1 (3); disclaimer, `scoring.v1` and weights visible; top labelled "Highest comparison score" |
| 5 | US3-2 | Expand GreenVolt breakdown | Penalties: "Earthing not stated (−5)", "Workmanship warranty not stated (−3)", "2 recommended details not stated (−2.1)"; parts 30.0 + 20.0 + 14.5 + 12.9 + 5.7 = 83.1 |
| 6 | US3-1 | Reload 3 times | Identical scores and order |
| 7 | US1-4 | Vendor GreenVolt withdraws (005) → household reloads | GreenVolt under "Withdrawn"; SunRise/SolarTech re-scored (price points change: SunRise becomes cheapest → 30) |
| 8 | US3-4 | Withdraw until one quote remains | One card, score shown, price part "only one quote — not compared", no "Highest" label |
| 9 | US4-1..3 | As demo vendor / second household / signed out call both endpoints | 403 / 404 / 401; no data |
| 10 | US1-5 | Request with no quotes | Empty state |
| 11 | US1-6 | Phone-width viewport | Stacked cards, no horizontal page scroll; table toggle hidden |

## Done when

All automated checks pass, rows 1–11 pass, and the GreenVolt hand calculation in research.md R-11
matches the UI breakdown.
