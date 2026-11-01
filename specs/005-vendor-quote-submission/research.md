# Research: Vendor Quote Submission

**Feature**: `005-vendor-quote-submission` | **Date**: 2026-11-01

No NEEDS CLARIFICATION remained in Technical Context; the decisions below record each real choice.

## R1. Writes only through SECURITY DEFINER functions; SELECT-only RLS

- **Decision**: `quotes` has RLS enabled with two SELECT policies (own vendor; owner household) and
  **no** INSERT/UPDATE/DELETE policies. Writes go through `submit_quote(...)` and
  `withdraw_quote(p_quote_id)`, both `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
  executable by `authenticated` only.
- **Rationale**: Supabase exposes tables to the browser. An INSERT policy would let a vendor insert
  a quote on a `draft`/`accepted` request or skip the `open` → `quoted` transition; an UPDATE policy
  would let a vendor edit price after submission (violates D-02) or set their own status to
  `accepted`. Functions centralise the rules where they cannot be bypassed and make the transition
  atomic (overview §5 rule 5).
- **Alternatives**: INSERT policy with a `WITH CHECK` sub-select on request status (cannot also
  update the request atomically, race-prone); triggers on `quotes` to update the request (hidden
  side effects, still needs an INSERT policy); service-role writes from the server only (DB would
  no longer know the caller; RLS tests would not prove anything).

## R2. Atomic first-quote transition and concurrency

- **Decision**: `submit_quote` does `SELECT status FROM household_requests WHERE id = $1 FOR UPDATE`,
  raises not-found for missing/`draft`, conflict for `accepted`/`closed`, inserts the quote, then
  `UPDATE household_requests SET status = 'quoted' WHERE id = $1 AND status = 'open'`, all in the
  function's single transaction.
- **Rationale**: The row lock serialises concurrent submissions and the 007 acceptance RPC (which
  must also lock the request row first), so a quote can never land on a request accepted
  mid-flight (FR-009). Duplicate submissions are serialised and the second hits the unique index.
- **Alternatives**: optimistic check-then-insert in the Route Handler (race window); advisory locks
  (unnecessary).

## R3. One active quote per vendor per request (D-02)

- **Decision**: Partial unique index `quotes_one_active_per_vendor_request ON quotes (request_id,
  vendor_id) WHERE status IN ('submitted','accepted')`. `submit_quote` also pre-checks and raises a
  friendly `SM409` with reason `DUPLICATE_ACTIVE_QUOTE`; a `23505` unique violation maps to the same
  error.
- **Rationale**: Constraint-level guarantee (constitution "constraints that enforce business
  rules"); withdrawn/rejected quotes do not block resubmission (FR-013).
- **Alternatives**: plain unique on (request_id, vendor_id) (blocks resubmission after withdraw);
  application-only check (race-prone).

## R4. Error signalling from SQL functions

- **Decision**: Functions raise custom SQLSTATEs mapped in `src/app/api/quotes/_lib/map-quote-db-error.ts`:
  `42501` → `403 FORBIDDEN` (not a vendor); `SM403` → `403 FORBIDDEN` (vendor profile missing);
  `SM404` → `404 NOT_FOUND` (request draft/missing, or quote not owned/missing); `SM409` →
  `409 CONFLICT` with `details[0].reason` = the exception message (`REQUEST_NOT_QUOTABLE`,
  `DUPLICATE_ACTIVE_QUOTE`, `QUOTE_NOT_WITHDRAWABLE`); `23505` → `409` `DUPLICATE_ACTIVE_QUOTE`;
  `23514` (CHECK violation) → `400 VALIDATION_FAILED`; else `500 INTERNAL` (generic message).
- **Rationale**: Stable machine-readable reasons without leaking SQL text (constitution VII).
- **Alternatives**: returning status JSON from the function (mixes error and data paths); parsing
  English error messages (fragile).

## R5. Validation in two layers

- **Decision**: Zod (`src/lib/validation/quote.ts`) is authoritative for request bodies (FR-003
  ranges, lengths, enums, integer rupees, ≤ 2 decimals for kW). The DB adds CHECK constraints for
  invariants that must hold even for direct RPC calls: `price BETWEEN 1000 AND 10000000`,
  `capacity_kw > 0 AND capacity_kw <= 100`, `installation_days BETWEEN 1 AND 365`, status/source
  enums, `jsonb_typeof` of `panel_details`/`inverter_details`/`warranty_details` = `object` and
  `other_inclusions` = `array`, text lengths ≤ 2000.
- **Rationale**: `submit_quote` is browser-callable, so the Route Handler's Zod check alone can be
  bypassed. Deep JSON shape is not re-validated in SQL; consumers (006) parse quote JSON with Zod
  `safeParse` because quote content is untrusted anyway (constitution III).
- **Alternatives**: revoke `EXECUTE` from `authenticated` and call via service role (loses
  `auth.uid()`-based enforcement); full JSON-schema validation in SQL (heavy, duplicated).

## R6. JSON shapes aligned with the plan §14 extraction contract

- **Decision**: `panel_details = { brand, model, wattage, quantity, technology, certifications[] }`,
  `inverter_details = { brand, model, type: 'on-grid'|'hybrid'|'off-grid', capacity_kw }`,
  `warranty_details = { panel_product_years, performance_years, inverter_years, workmanship_years }`;
  absent values are `null`. UI labels say "Make (brand)".
- **Rationale**: Same keys as plan §14 so 009 maps extraction output into the form with no
  renaming; product vs performance warranty stay distinct keys (plan §13).
- **Alternatives**: flattened columns (diverges from overview §7 jsonb columns); different key
  names (mapping layer for 009).

## R7. Tri-state inclusions

- **Decision**: `earthing_included` and `documentation_included` are nullable booleans; the form
  uses a 3-option radio ("Included / Not included / Not specified" → `true`/`false`/`null`).
- **Rationale**: "Missing earthing detail" (GreenVolt demo) must be distinguishable from "earthing
  not included"; 006 flags `null` as missing (FR-004).
- **Alternatives**: checkbox (cannot express unknown).

## R8. Taxes, payment milestones, exclusions as notes

- **Decision**: `exclusions` (text ≤ 2000) and `vendor_notes` (text ≤ 2000, labelled "Taxes,
  payment milestones and other terms"); `other_inclusions` is a jsonb array of ≤ 20 strings.
- **Rationale**: Matches overview §7 columns without adding structured tax/milestone columns that
  no P0 feature consumes.
- **Alternatives**: `gst_included` boolean / milestones table (schema extension with no consumer).

## R9. Untrusted text handling

- **Decision**: Trim and length-check only; no sanitising rewrite, no HTML/Markdown rendering
  (React text nodes only, never `dangerouslySetInnerHTML`); no AI call in this feature; free text
  is never parsed for instructions or used in any decision.
- **Rationale**: Constitution III — store, never interpret; verbatim storage keeps the source
  available for human review (plan §13 step 7).
- **Alternatives**: stripping suspicious phrases (alters evidence, easily bypassed).

## R10. Request summary for history

- **Decision**: Additional definer function `vendor_quoted_request_summaries()` returning
  `(request_id, locality, request_status)` for requests on which the caller has any quote, used by
  `GET /api/quotes/mine`.
- **Rationale**: 004's projections only cover `open`/`quoted` requests; history must also show
  `accepted`/`closed` outcomes. Locality and status are already permitted to vendors (D-01).
- **Alternatives**: vendor RLS on `household_requests` (column leak, see 004 research R1);
  denormalising locality into `quotes` (duplication, schema extension).

## R11. Withdrawal semantics

- **Decision**: `withdraw_quote` locks the quote row `FOR UPDATE`, requires
  `vendor_id = caller's vendor id` (else `SM404`), `status = 'submitted'` (else `SM409
  QUOTE_NOT_WITHDRAWABLE`), sets `withdrawn` and `updated_at = now()`. Request status unchanged.
- **Rationale**: Locking the quote row serialises with 007's acceptance (which updates the same
  quote rows); the canonical machine has no `quoted` → `open` transition.
- **Alternatives**: revert request to `open` when no active quotes remain (new transition, not in
  overview; listed as an open question).

## R12. Form technology

- **Decision**: shadcn/ui `Form` with `react-hook-form` and `zodResolver(quoteFieldsSchema)`;
  numeric inputs with `inputMode="numeric"`/`"decimal"`; ₹ grouping shown as helper text.
- **Rationale**: Same schema client/server; accessible labelled fields out of the box.
- **Alternatives**: hand-rolled controlled state (more code for errors/focus management).

## R13. Demo seed

- **Decision**: Append an idempotent "005 demo quotes" section to `supabase/seed.sql` that looks up
  the three demo vendors by `company_name` and the demo household's published request, inserts the
  three quotes only if the vendor has no active quote there, and sets the request `open` → `quoted`.
  Brands are prefixed "Demo" to avoid implying real manufacturers.
- **Rationale**: Gives 006/007 a realistic comparison set (plan §16) without manual setup.
- **Alternatives**: fixtures only in tests (no demo data for the pitch).
