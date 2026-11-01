# Research: Solar Financial Engine (003)

**Date**: 2026-11-01 · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

All values marked **ILLUSTRATIVE** are planning placeholders chosen so the demo produces
plausible numbers. They are NOT official values and MUST be verified against
https://pmsuryaghar.gov.in/ and https://mnre.gov.in/ (and the relevant DISCOM tariff order)
before the demo. The rule configuration stores `verification: "illustrative"` for each until a
person records a verified value, source document and retrieval date (constitution V, D-06).

---

## R-01 Rule configuration format

- **Decision**: A typed TypeScript module `src/config/rules/pm-surya-ghar.v1.ts` exporting one
  `RuleSet` object: `{ version: "pm-surya-ghar.v1", rules: Record<RuleKey, Rule> }`, where each
  `Rule` has `key`, `name`, `value`, `unit`, `consumerCategory`, `geography`, `sourceTitle`,
  `sourceUrl`, `effectiveDate`, `retrievedOn` (`string | null`; `null` = pending verification),
  `verification` (`"illustrative" | "verified"`), `limitations: string[]`. CFA slabs are one rule
  whose value is an array of `{ fromKw, toKw, ratePerKw }` plus a separate `cfa_cap` rule.
  Types live in `src/config/rules/types.ts`; `src/config/rules/index.ts` exports `activeRuleSet`.
  A Zod schema (`src/lib/validation/rules.ts`) validates the rule set in a unit test so a malformed
  edit fails CI.
- **Rationale**: Type-checked, versioned in git, importable by pure domain code and by the public
  `/api/rules` endpoint with no DB round trip. Satisfies "one versioned rule configuration, not in
  UI code".
- **Alternatives considered**: (a) DB table of rules — needs an admin UI and migrations for a
  value change; overkill for MVP. (b) JSON file — loses types and comments. (c) Hard-coded numbers
  as in plan §12 sample code — violates constitution V.

## R-02 Rule versioning

- **Decision**: The version string is `pm-surya-ghar.v1`. Any change to a value creates
  `pm-surya-ghar.v2.ts` and switches `activeRuleSet`; saved estimates keep the `rule_version` that
  produced them and are replaced on the next recalculation.
- **Rationale**: Reproducibility — a saved estimate can always be traced to the exact rules.
- **Alternatives considered**: Semantic version inside one file (harder to keep old versions
  side-by-side); date-only versions (less readable on the card).

## R-03 CFA calculation (illustrative baseline)

- **Decision**: `calculateCentralCfa(capacityKw, rules)`: throw `FinancialInputError` if
  `!Number.isFinite(kw) || kw < 0`; otherwise `Σ slabs ratePerKw × clamp(kw − fromKw, 0, toKw − fromKw)`,
  then `min(result, cap)`, then `Math.round` to whole rupees. Slabs: `0–2 kW @ ₹30,000`,
  `2–3 kW @ ₹18,000`; cap `₹78,000`. Matches plan §12 and overview §9.4 exactly; the cap is
  redundant under these slabs but kept as an explicit rule so a future version can change slabs
  safely.
- **Rationale**: Parameterised version of the plan's reference function; table-driven tests cover
  plan §18 values.
- **Alternatives considered**: Literal plan function with constants (not configurable).

## R-04 Capacity recommendation heuristic

- **Decision**: `recommendCapacityKw(monthlyUnits, rules)` =
  `ceilToStep((monthlyUnits × 12) / generationPerKwYear, 0.5)` clamped to `[1, 10]` kW, returning
  `{ capacityKw, notes[] }` with a note when raised to the minimum or capped at the maximum.
  `chooseEstimateCapacity(inputs, rules)` uses `preferredCapacityKw` when present and within
  `[1, 10]`, else the recommendation; returns `basis: "preferred" | "recommended"`.
- **Rationale**: Transparent, one-line formula (plan §12 "transparent heuristic based on
  consumption and a configurable expected generation"). Rounding **up** to 0.5 kW aims to cover
  annual consumption; 0.5 kW is a common panel-string increment. 10 kW upper bound keeps the tool
  residential; 1 kW lower bound is the smallest typical rooftop system.
  Demo: 250 units/month → 3,000 kWh/yr ÷ 1,400 = 2.14 → **2.5 kW recommended**; preferred 3 kW is
  used because it is in range.
- **Alternatives considered**: Round to nearest (under-sizes half the time); budget-constrained
  sizing (mixes two goals; budget is shown as a note instead); roof-area-based sizing (no reliable
  roof measurement — plan non-goal).

## R-05 Placeholder: expected annual generation per kW — ILLUSTRATIVE

- **Decision**: **1,400 kWh per kW per year** (≈ 3.8 units/kW/day).
- **Rationale**: Commonly quoted Indian rooftop rules of thumb are roughly 3.5–4.5 units per kW per
  day depending on location, orientation and losses. 1,400 sits at the conservative middle, avoiding
  over-promising savings for a south-Indian (Hyderabad) demo. Marked illustrative; verify with the
  PM Surya Ghar portal calculator or MNRE/NREL resource data for the location.
- **Alternatives considered**: 1,500 (more optimistic); location-specific irradiance lookup (needs a
  dataset; out of MVP scope).

## R-06 Placeholder: benchmark installation cost per kW — ILLUSTRATIVE

- **Decision**: **₹60,000 per kW** (installed, before subsidy).
- **Rationale**: A round figure in the range commonly seen for small residential on-grid systems; it
  gives the demo 3 kW system a ₹1,80,000 benchmark, close to the demo household's ₹1,50,000 budget
  and the sample vendor quotes, so the budget note and comparisons are meaningful. Verify against the
  current MNRE benchmark cost notification before the demo.
- **Alternatives considered**: Capacity-tiered cost per kW (more realistic economies of scale, more
  rules to verify); using the household's budget as cost (circular).

## R-07 Placeholder: tariff and bill-derived tariff — ILLUSTRATIVE

- **Decision**: Default tariff **₹7.00 per kWh**. If the household gives a monthly bill > 0, the
  tariff is `monthlyBill / monthlyUnits` clamped to **[₹3.00, ₹12.00]**; the estimate records
  `tariffBasis: "default" | "derived_from_bill" | "derived_from_bill_clamped"`.
- **Rationale**: The household's own bill is the best available signal of its marginal tariff; the
  clamp prevents nonsense inputs (e.g. a ₹50 bill for 300 units) from producing absurd savings. ₹7 is
  a plausible average for an upper residential slab. Fixed charges and slab structures are not
  modelled (stated as a limitation).
- **Alternatives considered**: DISCOM slab tables (accurate but per-state data that must be
  verified); no bill derivation (ignores user-provided information).

## R-08 Savings model with self-consumption share — ILLUSTRATIVE values

- **Decision**:
  `selfConsumedKwh = min(annualGenerationKwh × selfConsumptionShare, annualConsumptionKwh)`;
  `exportedKwh = annualGenerationKwh − selfConsumedKwh`;
  `annualSavings = round(selfConsumedKwh × tariff + exportedKwh × exportRate)`.
  Placeholders: **self-consumption share 0.70**, **export rate ₹3.00 per kWh**.
  Throws on negative or non-finite inputs.
- **Rationale**: Plan §12: "Do not assume every generated unit offsets the full retail tariff."
  Daytime generation is only partly consumed on site; exported units are compensated at a lower
  net-billing/feed-in rate. Capping self-consumption at annual consumption means oversized systems do
  not gain retail-rate savings for units the home never uses. Demo (3 kW, 250 units/month, default
  tariff): generation 4,200 kWh; self-consumed 2,940; exported 1,260; savings ≈ ₹24,360/yr;
  net cost ₹1,02,000; payback ≈ 4.2 years.
- **Alternatives considered**: Full-tariff offset (plan explicitly forbids); hourly load matching
  (needs load profile data); plan's `calculateAnnualSavings(monthlySavings)` (needs a monthly savings
  input that does not exist yet) — kept only conceptually as `annual = monthly × 12` is not used.

## R-09 Payback

- **Decision**: `calculateSimplePaybackYears(netCost, annualSavings)` — throws on negative or
  non-finite input; returns `null` when `annualSavings === 0`; else `netCost / annualSavings`.
  Rounded to one decimal only when assembling the estimate/display.
- **Rationale**: Plan §12 reference behaviour; `null` is persisted as SQL `NULL` and shown as
  "Not applicable — no estimated savings".
- **Alternatives considered**: Returning `Infinity` (breaks JSON and UI); returning 0 (misleading).

## R-10 Estimate assembly and rounding

- **Decision**: `buildSolarEstimate(inputs, rules, options?)` in
  `src/lib/domain/financial/estimate.ts` composes the functions above and returns
  `{ capacityKw, recommendedCapacityKw, capacityBasis, installationCost, subsidyEstimate, netCost,
  annualGenerationKwh, annualSavingsEstimate, paybackYears, ruleVersion, assumptions }`.
  `options.capacityOverrideKw` produces previews (what-if). Rounding: money `Math.round` to rupees,
  energy to whole kWh, payback to 1 decimal, capacity to 2 decimals. Notes (`assumptions.notes[]`)
  are fixed English strings selected by code (min/max capacity, preferred ignored, tariff clamped,
  over budget).
- **Rationale**: One pure entry point keeps the route handler thin and lets 006/011 reuse it.
- **Alternatives considered**: Computing in SQL (harder to unit-test; duplicates logic).

## R-11 Persistence and recalculation trigger

- **Decision**: `POST /api/solar/calculate` with `{ requestId }` loads the request's stored inputs
  (user-scoped client, so RLS confirms ownership), computes, and **upserts** `solar_estimates` on
  `request_id` using the server-only admin client. The estimate card calls it on mount and when the
  card's `inputsKey` (units/bill/budget/preferred capacity) changes. A second mode `{ preview: {…} }`
  computes without saving (US3, and the wizard if inputs are not yet saved).
- **Rationale**: Calculation is instant, so "recompute on view" keeps saved estimates consistent with
  current inputs without coupling 002's PATCH handler to 003 (overview: "Recomputed on input change").
  Writing with the admin client after server-side authorization means no RLS insert/update policy is
  needed, so a household cannot write arbitrary numbers into its own estimate from the browser.
- **Alternatives considered**: DB trigger on `household_requests` update (logic in SQL, duplicated);
  002 calling a 003 service in its PATCH (cross-feature coupling); RLS insert policy for owners
  (lets a client forge estimate values).

## R-12 Authorization conventions

- **Decision**: Not signed in → 401 `UNAUTHENTICATED`; signed-in vendor → 403 `FORBIDDEN`;
  household that does not own the request (row invisible under RLS) → 404 `NOT_FOUND`; request
  without monthly units → 409 `CONFLICT` with message "Enter monthly consumption to calculate an
  estimate". The same 403/404 convention is used by 006 and 007.
- **Rationale**: 404 for non-owners avoids confirming that another household's request exists and
  falls naturally out of RLS-filtered reads.
- **Alternatives considered**: 403 for non-owners (leaks existence); 400 for missing units (the body
  is valid; the resource state is not).

## R-13 Rules page and API

- **Decision**: `GET /api/rules` returns `activeRuleSet` plus the CFA example table computed by
  `calculateCentralCfa` for 1, 1.5, 2, 2.5, 3, 5 kW (so the table can never disagree with the code).
  `src/app/rules/page.tsx` is a server component that imports the same config directly (no fetch),
  with an error boundary for the error state; the API exists for other clients and the advisor.
- **Rationale**: Public, cacheable, no DB. Computing the example table from code guarantees
  consistency.
- **Alternatives considered**: Static markdown page (could drift from config).

## R-14 Dependencies

- **Decision**: No new runtime dependency. Uses Zod, shadcn/ui (`Card`, `Badge`, `Alert`, `Select`,
  `Skeleton`, `Button`) and Lucide icons already provided by 001. Recharts is not needed.
- **Rationale**: Constitution VIII.

## R-15 Test strategy

- **Decision**: Vitest unit tests per domain function (table-driven for plan §18 values),
  config-schema test, Zod input tests; Vitest integration tests against local Supabase for the
  endpoint (owner / other household / vendor / anonymous) and RLS on `solar_estimates`; one
  Playwright check that the rules page and estimate card show assumptions and rule version.
- **Rationale**: Constitution VI and plan §18 "Financial tests" (verbatim list in tasks.md).
