# Data Model: Vendor Quote Submission

**Feature**: `005-vendor-quote-submission` | **Date**: 2026-11-01
**Canonical source**: `docs/project-overview.md` §7 (`quotes`, owner 005). Migration:
`supabase/migrations/20261101000500_quotes.sql`.

## 1. Table `quotes`

| Column | Type | Null | Default | Constraint / rule |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `request_id` | uuid | no | — | FK → `household_requests(id)` ON DELETE CASCADE |
| `vendor_id` | uuid | no | — | FK → `vendors(id)` ON DELETE CASCADE |
| `price` | integer (INR) | no | — | `CHECK (price BETWEEN 1000 AND 10000000)` |
| `capacity_kw` | numeric(6,2) | no | — | `CHECK (capacity_kw > 0 AND capacity_kw <= 100)` |
| `panel_details` | jsonb | no | `'{}'` | `CHECK (jsonb_typeof(panel_details) = 'object')` — shape §2 |
| `inverter_details` | jsonb | no | `'{}'` | `CHECK (jsonb_typeof(inverter_details) = 'object')` — shape §2 |
| `warranty_details` | jsonb | no | `'{}'` | `CHECK (jsonb_typeof(warranty_details) = 'object')` — shape §2 |
| `installation_days` | integer | no | — | `CHECK (installation_days BETWEEN 1 AND 365)` |
| `earthing_included` | boolean | yes | `NULL` | `NULL` = not specified |
| `documentation_included` | boolean | yes | `NULL` | `NULL` = not specified (metering/net-metering/subsidy paperwork) |
| `other_inclusions` | jsonb | no | `'[]'` | `CHECK (jsonb_typeof(other_inclusions) = 'array')`; ≤ 20 strings ≤ 200 chars (Zod) |
| `exclusions` | text | yes | `NULL` | `CHECK (char_length(exclusions) <= 2000)` |
| `vendor_notes` | text | yes | `NULL` | `CHECK (char_length(vendor_notes) <= 2000)`; taxes, payment milestones, other terms |
| `source` | text | no | `'manual'` | `CHECK (source IN ('manual','ai_extracted'))` |
| `source_document_path` | text | yes | `NULL` | Always `NULL` in 005; set by 009 (`quote-documents/{vendor_user_id}/{quote_id}/…`) |
| `status` | text | no | `'submitted'` | `CHECK (status IN ('submitted','accepted','rejected','withdrawn'))` |
| `created_at` | timestamptz | no | `now()` | |
| `updated_at` | timestamptz | no | `now()` | maintained by trigger `quotes_set_updated_at` using 001's `public.set_updated_at()` (created with `CREATE OR REPLACE` in this migration if 001 did not define it) |

Columns, names and enums match overview §7 exactly. **Extension to overview §7**: the CHECK
constraints and the partial unique index below (overview only says "Unique active quote per
(request, vendor)").

### Indexes

| Name | Definition | Purpose |
|---|---|---|
| `quotes_one_active_per_vendor_request` | `UNIQUE (request_id, vendor_id) WHERE status IN ('submitted','accepted')` | D-02 / FR-007 |
| `quotes_request_id_idx` | `(request_id)` | household comparison (006), acceptance (007) |
| `quotes_vendor_created_idx` | `(vendor_id, created_at DESC)` | vendor history |

## 2. JSON shapes (Zod in `src/lib/validation/quote.ts`; unknown = `null`)

```text
panel_details    { brand: string≤100|null, model: string≤100|null, wattage: int 1–1000|null (Wp),
                   quantity: int 1–1000|null, technology: string≤100|null,
                   certifications: string≤60[] (max 10) }
inverter_details { brand: string≤100|null, model: string≤100|null,
                   type: 'on-grid'|'hybrid'|'off-grid'|null, capacity_kw: number >0 ≤100|null }
warranty_details { panel_product_years: int 0–40|null, performance_years: int 0–40|null,
                   inverter_years: int 0–40|null, workmanship_years: int 0–40|null }
other_inclusions string≤200[] (max 20)
```

Keys match the plan §14 extraction contract so 009 can pre-fill without renaming.

### Zod schemas

- `quoteStatusSchema` = `submitted|accepted|rejected|withdrawn`; `quoteSourceSchema` = `manual|ai_extracted`.
- `quoteFieldsSchema` (reusable form content): `price` int 1,000–10,000,000; `capacity_kw` >0 ≤100,
  ≤ 2 decimals; `panel_details`, `inverter_details`, `warranty_details` (above);
  `installation_days` int 1–365; `earthing_included`, `documentation_included` boolean|null;
  `other_inclusions`; `exclusions`, `vendor_notes` string ≤ 2000 trimmed, empty → `null`.
- `quoteSubmissionSchema` = `quoteFieldsSchema.extend({ request_id: uuid })` (strict: unknown keys rejected, so `status`, `source`, `vendor_id` cannot be supplied).
- `myQuotesQuerySchema` = `{ status?: quoteStatus, request_id?: uuid }`; `quoteIdParamSchema` = `{ id: uuid }`.

## 3. RLS policies (`ALTER TABLE quotes ENABLE ROW LEVEL SECURITY`)

| Policy | Command | Role | USING |
|---|---|---|---|
| `quotes_select_own_vendor` | SELECT | authenticated | `vendor_id IN (SELECT v.id FROM vendors v WHERE v.user_id = auth.uid())` |
| `quotes_select_request_owner` | SELECT | authenticated | `EXISTS (SELECT 1 FROM household_requests hr WHERE hr.id = quotes.request_id AND hr.user_id = auth.uid())` (for 006) |

No INSERT, UPDATE or DELETE policies (all writes via §4 functions; 007's acceptance RPC is also
definer). `anon` has no access.

## 4. Extension to overview §7 — database functions

All: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
`REVOKE ALL ... FROM public, anon`, `GRANT EXECUTE ... TO authenticated`.
Vendor guard: caller's `profiles.role = 'vendor'` else `42501`; caller's `vendors.id` (by
`user_id = auth.uid()`) else `SM403 VENDOR_PROFILE_MISSING`.

### 4.1 `submit_quote(p_request_id uuid, p_price integer, p_capacity_kw numeric, p_panel_details jsonb, p_inverter_details jsonb, p_warranty_details jsonb, p_installation_days integer, p_earthing_included boolean, p_documentation_included boolean, p_other_inclusions jsonb, p_exclusions text, p_vendor_notes text) RETURNS quotes`

1. Vendor guard → `v_vendor_id`.
2. `SELECT status INTO v_status FROM household_requests WHERE id = p_request_id FOR UPDATE`.
3. Not found or `draft` → `SM404 REQUEST_NOT_FOUND`; `accepted`/`closed` → `SM409 REQUEST_NOT_QUOTABLE`.
4. Active quote exists for (request, vendor) → `SM409 DUPLICATE_ACTIVE_QUOTE` (index is the backstop → `23505`).
5. `INSERT INTO quotes (..., source, status) VALUES (..., 'manual', 'submitted') RETURNING *`.
6. `UPDATE household_requests SET status = 'quoted', updated_at = now() WHERE id = p_request_id AND status = 'open'`.
7. Return the inserted row.

### 4.2 `withdraw_quote(p_quote_id uuid) RETURNS quotes`

1. Vendor guard → `v_vendor_id`.
2. `SELECT * FROM quotes WHERE id = p_quote_id AND vendor_id = v_vendor_id FOR UPDATE`; none → `SM404 QUOTE_NOT_FOUND`.
3. `status <> 'submitted'` → `SM409 QUOTE_NOT_WITHDRAWABLE`.
4. `UPDATE quotes SET status = 'withdrawn', updated_at = now() ... RETURNING *`. Request status untouched.

### 4.3 `vendor_quoted_request_summaries() RETURNS TABLE (request_id uuid, locality text, request_status text)`

`STABLE`. Vendor guard; returns `hr.id, hr.locality, hr.status::text` for requests having at least
one quote with `vendor_id = v_vendor_id`. No other request columns.

### Error mapping (`src/app/api/quotes/_lib/map-quote-db-error.ts`)

| SQLSTATE / reason | API code | HTTP |
|---|---|---|
| `42501` | `FORBIDDEN` | 403 |
| `SM403` `VENDOR_PROFILE_MISSING` | `FORBIDDEN` | 403 |
| `SM404` `REQUEST_NOT_FOUND` / `QUOTE_NOT_FOUND` | `NOT_FOUND` | 404 |
| `SM409` `REQUEST_NOT_QUOTABLE` / `DUPLICATE_ACTIVE_QUOTE` / `QUOTE_NOT_WITHDRAWABLE` | `CONFLICT` (`details[0].reason`) | 409 |
| `23505` on `quotes_one_active_per_vendor_request` | `CONFLICT` (`DUPLICATE_ACTIVE_QUOTE`) | 409 |
| `23514` | `VALIDATION_FAILED` | 400 |
| other | `INTERNAL` | 500 |

## 5. State transitions

```text
quotes:              (new) ──submit_quote──> submitted ──withdraw_quote──> withdrawn      [005]
                                             submitted ──accept (007)──> accepted
                                             submitted ──other quote accepted (007)──> rejected
household_requests:  open ──first submit_quote──> quoted        [005; all other transitions owned by 002/007]
                     quoted ──submit_quote / withdraw_quote──> quoted (unchanged)
```

Pure mirrors in `src/lib/domain/`: `isQuotableRequestStatus(s) = s ∈ {open, quoted}`;
`requestStatusAfterQuote('open') = 'quoted'`, `('quoted') = 'quoted'`, other → error;
`isActiveQuoteStatus(s) = s ∈ {submitted, accepted}`; `canWithdrawQuote(s) = s === 'submitted'`.

## 6. Demo seed (`supabase/seed.sql`, section "005 demo quotes")

Request: the demo household's published "Sharma Residence" request (Hyderabad, 250 units,
₹1,50,000, 3 kW). All brands fictional, prefixed "Demo".

| Vendor | Price | kW | Panels | Inverter | Warranty (product/performance/inverter/workmanship) | Days | Earthing | Docs | Strength / weakness |
|---|---|---|---|---|---|---|---|---|---|
| SunRise Energy | 1,65,000 | 3.30 | Demo SunCell SC-550M, 550 Wp × 6, Mono PERC, [BIS certified, ALMM listed] | Demo InvertaGrid IG-3K, on-grid, 3 kW | 12 / 25 / 8 / 5 | 21 | true | true | Competitive, every field complete; inclusions: mounting structure, DC/AC cabling, lightning arrester, net-metering support; notes: GST included, 40/50/10 milestones |
| GreenVolt Solar | 1,42,000 | 3.00 | Demo VoltPanel VP-500, 500 Wp × 6, Polycrystalline, [BIS certified] | Demo GridMate GM-3, on-grid, 3 kW | 10 / 25 / 5 / null | 25 | **null** | true | Lowest price; earthing not specified; fewer inclusions |
| SolarTech Solutions | 1,89,000 | 3.30 | Demo TopCell TC-550N, 550 Wp × 6, N-type TOPCon bifacial, [BIS certified, ALMM listed, IEC 61215] | Demo PrimeInvert PI-3.3, on-grid, 3.3 kW | 15 / 30 / 10 / 10 | 10 | true | true | Premium components, fastest installation |

Idempotent: insert only when the vendor has no active quote on that request; then
`UPDATE household_requests SET status = 'quoted' WHERE id = <demo request> AND status = 'open'`.
If the demo request is not published (`open`/`quoted`), the section is a no-op. The malicious
injected quote is **not** seeded here (owned by 009).
