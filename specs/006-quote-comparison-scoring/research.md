# Research: Quote Comparison and Scoring (006)

**Date**: 2026-11-01 · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## R-01 Scoring configuration

- **Decision**: `src/config/scoring.v1.ts` exports `scoringConfig` (typed, `as const`):

  ```text
  version: "scoring.v1"
  weights: { price: 30, technical: 25, warranty: 20, completeness: 15, timeline: 10 }   // sum = 100
  technicalItems (5 each): panelDetailsComplete, panelCapacityConsistent,
                           inverterDetailsComplete, inverterAdequatelySized, earthingIncluded
  warranty: panelProduct {points 6, targetYears 10}, panelPerformance {6, 25},
            inverter {5, 10}, workmanship {3, 5}                                       // sum = 20
  timeline: { fullPointsAtOrBelowDays: 10, zeroPointsAtOrAboveDays: 45 }
  tolerances: { capacityMismatchRatio: 0.10, inverterMinRatio: 0.80 }
  flags: { lowPriceVsMedianRatio: 0.70, capacityFarFromRequestRatio: 0.50 }
  recommendedItems: [panelBrand, panelWattage, panelQuantity, panelCertifications,
                     inverterBrand, inverterType, inverterCapacity, warrantyPanelProduct,
                     warrantyPanelPerformance, warrantyInverter, warrantyWorkmanship,
                     installationDays, earthingStated, documentationStated]             // 14
  disclaimer: "Comparison score defined by SolarX for guidance only — not a government,
               official or certification rating."
  ```

  A unit test asserts weights sum to 100, technical items × 5 = 25, warranty points sum to 20.
- **Rationale**: Overview §6 path; weights from plan §13 / overview §9.5. All targets in one
  versioned place so a change bumps `scoring.v2` and saved reviews record the version.
- **Alternatives considered**: DB-stored weights (needs admin UI; out of scope);
  household-adjustable weights (complicates determinism/explanation; out of scope).

## R-02 Normalization (defensive parsing)

- **Decision**: `normalizeQuote(quoteRow)` in `src/lib/domain/quotes/normalize.ts` returns a
  `NormalizedQuote` with every field `T | null`. Each jsonb sub-field is parsed independently
  (Zod `safeParse` per field in `src/lib/validation/quote-review.ts`): absent, wrong type,
  non-finite, ≤ 0 where positive is required → `null`. Booleans accept only `true`/`false`
  (anything else → `null`). Certifications: non-empty array of non-empty strings, else `null`.
  Warranty years follow 005 (int 0–40): `0` is a stated "no warranty" (known, earns 0 points, not
  a penalty, not missing); `null`/absent is unknown. Certifications follow 005 (always an array):
  an empty array counts as "not stated". Years are capped only at scoring (normalized value kept
  as stated). Text fields
  (`other_inclusions`, `exclusions`, `vendor_notes`) are carried as display-only strings.
  Expected jsonb keys (005 data-model §2 / plan §14):
  `panel_details {brand, model, wattage, quantity, certifications}`,
  `inverter_details {brand, model, type, capacity_kw}`,
  `warranty_details {panel_product_years, performance_years, inverter_years, workmanship_years}`.
- **Rationale**: Constitution II ("unknown values stay null"); 005's exact jsonb shape is not yet
  fixed, and a parsing failure in one field must not break the screen.
- **Alternatives considered**: Whole-object strict schema (one bad key hides the whole quote);
  defaulting unknowns to 0 (would display misleading zeros).

## R-03 Structured-only scoring input (injection-proof by construction)

- **Decision**: `toScoringInput(normalized)` returns a `ScoringInput` type containing only:
  `quoteId, submittedAt, price, capacityKw, panel{brand,wattage,quantity,certifications},
  inverter{brand,type,capacityKw}, warranty{panelProduct,panelPerformance,inverter,workmanship},
  installationDays, earthingIncluded, documentationIncluded`. `scoreQuotes()` and
  `computeFlags()` accept only `ScoringInput` (plus request budget/capacity), so vendor notes,
  inclusions, exclusions, vendor name and document text are unreachable at the type level.
- **Rationale**: Ranking must be fully code-determined; feature 009 will assert an injected
  instruction cannot change score or order. Making free text unreachable is stronger than
  "ignoring" it.
- **Alternatives considered**: Passing the whole quote and relying on code review (fragile).

## R-04 Sub-score formulas (deterministic, explainable)

Let the **compared set** = request's quotes with status ≠ `withdrawn` that pass required-field
validation (price > 0, capacity > 0). `ppk = price / capacityKw`.

| Part (max) | Formula | Unknown handling |
|---|---|---|
| Price (30) | `30 × minPpk / ppk` where `minPpk` = lowest ppk in the compared set | Price and capacity are required, never unknown. Single quote → 30, labelled "not compared" |
| Technical (25) | 5 × each of: (a) panel brand, wattage, quantity all known; (b) `abs(wattage×quantity/1000 − capacityKw)/capacityKw ≤ 0.10`; (c) inverter brand, type, capacity all known; (d) `inverterCapacityKw ≥ 0.80 × capacityKw`; (e) `earthingIncluded === true` | Any input of an item unknown → 0 for that item + penalty "X not stated (−5)". `earthingIncluded === false` → 0, reason "not included" (known, not a penalty) |
| Warranty (20) | `6×min(pp/10,1) + 6×min(perf/25,1) + 5×min(inv/10,1) + 3×min(work/5,1)` | Unknown → 0 + penalty with forgone max points (−6/−6/−5/−3) |
| Completeness (15) | `15 × statedRecommended / 14` | Each missing item listed (−1.1 each, display) |
| Timeline (10) | `d ≤ 10 → 10`; `d ≥ 45 → 0`; else `10 × (45 − d) / 35` | Unknown → 0 + penalty "Installation timeline not stated (−10)" |

- **Rounding**: each part → integer tenths (`Math.round(raw × 10)`); total tenths = sum of part
  tenths; displayed as tenths / 10. Comparison and ties use integer tenths (no float equality).
- **Ordering**: total tenths desc → ppk asc → `submittedAt` asc → `quoteId` asc (lexicographic).
  `tied = true` for any quote sharing its total with another. Input order is irrelevant because
  the comparator is total and fully specified.
- **Rationale**: Each formula fits in one line on the breakdown, rewards only verified
  information, and never rewards unknowns (plan §13). Price relative to the cheapest
  normalises across capacities; capped warranty targets stop absurd values being rewarded;
  timeline uses absolute bounds because "fast relative to a slow peer" is not meaningful.
- **Alternatives considered**: Price relative to the 003 benchmark cost (ties score to an
  unverified placeholder); min-max price normalisation (cheapest 30, dearest 0 — over-penalises
  small differences, unstable with 2 quotes); relative timeline (harsh with one fast vendor);
  per-quote net cost in price (CFA cap distorts across capacities).

## R-05 Flags

- **Decision**: `computeFlags(input, context)` in `src/lib/domain/quotes/flags.ts` returns
  `{ code, severity, message, field? }[]` sorted by fixed code order:
  `MISSING_<ITEM>` (warning) · `EARTHING_NOT_INCLUDED` (warning) ·
  `DOCUMENTATION_NOT_INCLUDED` (warning) · `CAPACITY_MISMATCH` (warning, >10%) ·
  `INVERTER_UNDERSIZED` (warning, < 0.8) · `ABOVE_BUDGET` (info, price > request budget) ·
  `UNUSUALLY_LOW_PRICE` (info, ppk < 0.70 × median ppk, ≥ 2 compared quotes) ·
  `CAPACITY_FAR_FROM_REQUEST` (info, |capacity − reference| / reference > 0.5, reference =
  `preferred_capacity_kw` else saved `solar_estimates.capacity_kw` else none) ·
  `INVALID_QUOTE` (warning; excluded from scoring).
  Flags never feed into the score (scores come only from R-04).
- **Rationale**: Clear, testable rules; separation means a flag cannot double-penalise.
- **Alternatives considered**: Flag-based deductions (opaque double counting).

## R-06 Per-quote estimates

- **Decision**: `subsidyEstimate = calculateCentralCfa(capacityKw, activeRuleSet)`,
  `netCostEstimate = calculateNetCost(price, subsidyEstimate)` from 003; stored in
  `normalized_fields.platformEstimates { subsidyEstimate, netCostEstimate, ruleVersion }` and
  labelled "Estimate" in UI. Not used in scoring.
- **Rationale**: Reuse 003, no new columns; plan §7 screen 4 "estimated net cost".
- **Alternatives considered**: Separate columns (extends §7 unnecessarily); per-quote payback
  (out of scope; would need consumption-based savings for each capacity).

## R-07 Persistence and recompute policy

- **Decision**: `POST /api/quotes/compare { requestId }` loads all quotes of the request,
  normalizes, scores the compared set, upserts one `quote_reviews` row per compared quote
  (`on conflict (quote_id) do update`) via the server-only admin client after authorization,
  and returns the ordered result. `score_breakdown` also stores `comparison {rank, comparedCount,
  tied, comparedQuoteIds}` so a saved review is self-describing. Reviews for quotes that became
  withdrawn are left untouched (not shown). The comparison page calls compare on every open.
- **Rationale**: Relative price points depend on the set; recompute-on-view is instant and always
  correct. Admin-client writes after a server check mean no RLS write policy, so households
  cannot forge scores.
- **Alternatives considered**: Recompute on quote insert (trigger/job; cross-feature coupling with
  005); body with an arbitrary subset of quote ids (complicates persistence; not required).

## R-08 Explanation sentence (code, not AI)

- **Decision**: `buildExplanation(review, context)` assembles fixed templates:
  `"{Highest comparison score|Rank n of N|Only quote received}. {Lowest price per kW|Price per kW
  x% above the lowest}. {All recommended details provided|k recommended details not stated}.
  {Largest penalty phrase, if any}."`
- **Rationale**: Satisfies `quote_reviews.explanation` deterministically; AI explanation is 011.

## R-09 Authorization

- **Decision**: anon → 401; vendor → 403; household not owning the request (row invisible
  under RLS via user-scoped client) → 404; owner → 200. Same convention as 003/007. Quotes are
  read with the user-scoped client (005's RLS lets the owner household read quotes on its
  requests). Vendor `company_name` and `verification_status` are read with the user-scoped client
  (001's `vendors_select_authenticated` policy allows signed-in users to read vendor business
  details; it holds no personal name or phone).
- **Rationale**: Constitution IV; do not leak existence of other households' requests.

## R-10 Comparison UI

- **Decision**: Page `src/app/household/requests/[id]/quotes/page.tsx` renders
  `QuoteComparisonView` (client component) which calls compare and renders: summary bar
  (weights, version, disclaimer), stacked `QuoteCard`s (all widths) and a `QuoteComparisonTable`
  (≥ md, toggle "Cards | Table"), `ScoreBreakdown` (disclosure), `QuoteFlags` (missing items +
  flags), `EstimateBadge` from 003 for estimate vs vendor-confirmed. `QuoteCard` accepts an
  `actionSlot` prop that 007 fills with the accept button. Vendor text rendered as plain text
  (React escaping; no `dangerouslySetInnerHTML`).
- **Rationale**: Plan §7 screen 4; mobile-first; clean extension point for 007.
- **Alternatives considered**: Recharts radar chart of parts (nice but not needed; no new
  dependency).

## R-11 Worked example — demo fixtures (`tests/fixtures/quotes/demo-quotes.ts`)

Values mirror 005's demo seed (`specs/005-vendor-quote-submission/data-model.md` demo table);
all fictional. Request budget ₹1,50,000, preferred 3 kW.

| | SunRise Energy (Demo) | GreenVolt Solar (Demo) | SolarTech Solutions (Demo) |
|---|---|---|---|
| Price / capacity / ppk | ₹1,65,000 / 3.30 / 50,000 | ₹1,42,000 / 3.00 / 47,333 | ₹1,89,000 / 3.30 / 57,273 |
| Panels | 6 × 550 W, certs [BIS, ALMM] | 6 × 500 W, certs [BIS] | 6 × 550 W, certs [BIS, ALMM, IEC 61215] |
| Inverter | on-grid 3 kW | on-grid 3 kW | on-grid 3.3 kW |
| Warranty (prod/perf/inv/work) | 12/25/8/5 | 10/25/5/not stated | 15/30/10/10 |
| Days / earthing / docs | 21 / yes / yes | 25 / not stated / yes | 10 / yes / yes |
| Price | 28.4 | 30.0 | 24.8 |
| Technical | 25.0 | 20.0 (earthing not stated) | 25.0 |
| Warranty | 19.0 | 14.5 | 20.0 |
| Completeness | 15.0 | 12.9 (12/14) | 15.0 |
| Timeline | 6.9 | 5.7 | 10.0 |
| **Total / rank** | **94.3 / 2** | **83.1 / 3** | **94.8 / 1** |
| Subsidy est. / net cost est. | 78,000 / 87,000 | 78,000 / 64,000 | 78,000 / 1,11,000 |
| Missing items | none | warrantyWorkmanship, earthingStated | none |
| Flags | ABOVE_BUDGET | MISSING_WARRANTY_WORKMANSHIP, MISSING_EARTHING_STATED | ABOVE_BUDGET |
| Penalties | none | Earthing not stated (−5 technical); Workmanship warranty not stated (−3); 2 items not stated (−2.1 completeness) | none |

Explanations: SolarTech "Highest comparison score. Price per kW 21% above the lowest. All
recommended details provided."; SunRise "Rank 2 of 3. Price per kW 6% above the lowest. All
recommended details provided."; GreenVolt "Rank 3 of 3. Lowest price per kW. 2 recommended
details not stated. Earthing not stated (−5)."

These numbers are the expected values for unit tests. If 005's seed changes, update this table and
the fixture together; the fixture is authoritative for 006 unit tests.

## R-12 Dependencies

- **Decision**: No new runtime dependency (Zod, shadcn/ui `Card`, `Table`, `Badge`, `Collapsible`,
  `Tabs`, `Alert`, `Skeleton`; Lucide).
