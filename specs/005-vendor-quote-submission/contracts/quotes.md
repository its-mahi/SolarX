# Contract: Vendor quote endpoints

**Feature**: `005-vendor-quote-submission` · Envelope and codes: overview §8 · Schemas:
`src/lib/validation/quote.ts` (see [data-model.md](../data-model.md) §2). Field names are `snake_case`.

Common rules:

- Auth: Supabase session cookie; none ⇒ `401 UNAUTHENTICATED`.
- Role: caller's profile role must be `vendor` (server check via 001's auth guard) **and** the DB
  functions re-check role and vendor profile; household ⇒ `403 FORBIDDEN`.
- Bodies are parsed with `.strict()` Zod schemas: unknown keys (e.g. `status`, `source`,
  `vendor_id`) ⇒ `400`.
- Error body: `{ "error": { "code", "message", "details": [] } }`. Validation details:
  `[{ "path": "price", "message": "…" }]`. Conflict details: `[{ "reason": "DUPLICATE_ACTIVE_QUOTE" }]`.
- Free-text fields are returned exactly as stored; clients render them as plain text.

### `QuoteRecord` (response shape)

```json
{
  "id": "b2d4…",
  "request_id": "6f1c…",
  "price": 165000,
  "capacity_kw": 3.3,
  "panel_details": { "brand": "Demo SunCell", "model": "SC-550M", "wattage": 550, "quantity": 6, "technology": "Mono PERC", "certifications": ["BIS certified", "ALMM listed"] },
  "inverter_details": { "brand": "Demo InvertaGrid", "model": "IG-3K", "type": "on-grid", "capacity_kw": 3 },
  "warranty_details": { "panel_product_years": 12, "performance_years": 25, "inverter_years": 8, "workmanship_years": 5 },
  "installation_days": 21,
  "earthing_included": true,
  "documentation_included": true,
  "other_inclusions": ["Mounting structure", "DC & AC cabling", "Lightning arrester"],
  "exclusions": "Civil work for structures elevated above 1 m",
  "vendor_notes": "Price includes GST. 40% advance, 50% after installation, 10% after net-meter commissioning.",
  "source": "manual",
  "status": "submitted",
  "created_at": "2026-11-01T10:00:00Z",
  "updated_at": "2026-11-01T10:00:00Z"
}
```

`vendor_id` and `source_document_path` are not returned to vendors in 005.

---

## POST `/api/quotes`

**Role**: vendor · **Purpose**: submit a quote (FR-001..FR-009).

### Request body (`quoteSubmissionSchema`)

| Field | Type | Required | Rule |
|---|---|---|---|
| `request_id` | uuid | yes | |
| `price` | integer | yes | 1,000–10,000,000 INR |
| `capacity_kw` | number | yes | > 0, ≤ 100, ≤ 2 decimals |
| `panel_details` | object | yes (may contain nulls) | data-model §2 |
| `inverter_details` | object | yes (may contain nulls) | data-model §2 |
| `warranty_details` | object | yes (may contain nulls) | data-model §2, each 0–40 int or null |
| `installation_days` | integer | yes | 1–365 |
| `earthing_included` | boolean \| null | yes | null = not specified |
| `documentation_included` | boolean \| null | yes | null = not specified |
| `other_inclusions` | string[] | yes (may be empty) | ≤ 20 items, each ≤ 200 chars |
| `exclusions` | string \| null | no | ≤ 2000 chars |
| `vendor_notes` | string \| null | no | ≤ 2000 chars |

### 201 response

```json
{ "data": { "quote": { "…": "QuoteRecord" }, "request_status": "quoted" } }
```

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | body invalid / unknown keys / DB CHECK violation |
| `UNAUTHENTICATED` | 401 | no session |
| `FORBIDDEN` | 403 | not a vendor, or vendor profile missing (`message`: "Complete your vendor profile before quoting.") |
| `NOT_FOUND` | 404 | request `draft` or nonexistent |
| `CONFLICT` | 409 | `REQUEST_NOT_QUOTABLE` (request `accepted`/`closed`) · `DUPLICATE_ACTIVE_QUOTE` |
| `INTERNAL` | 500 | unexpected |

Example 409:

```json
{ "error": { "code": "CONFLICT", "message": "You already have an active quote on this request. Withdraw it to submit a new one.", "details": [{ "reason": "DUPLICATE_ACTIVE_QUOTE" }] } }
```

**Authorization rule**: caller is a vendor with a `vendors` row; request is `open`/`quoted`; caller
has no `submitted`/`accepted` quote on it. Enforced in `submit_quote` under a row lock.

---

## GET `/api/quotes/mine`

**Role**: vendor · **Purpose**: own quote history (FR-015, FR-016).

### Query (`myQuotesQuerySchema`)

| Name | Type | Rule |
|---|---|---|
| `status` | `submitted`\|`accepted`\|`rejected`\|`withdrawn` | optional |
| `request_id` | uuid | optional (used by the request detail panel) |

### 200 response

```json
{
  "data": {
    "items": [
      {
        "…": "QuoteRecord fields",
        "request": { "id": "6f1c…", "locality": "Kondapur, Hyderabad", "status": "quoted" }
      }
    ]
  }
}
```

Ordered by `created_at` desc. Contains only the caller's quotes (RLS `quotes_select_own_vendor`);
request summary from `vendor_quoted_request_summaries()`. Empty list ⇒ `items: []`.

### Errors

`400 VALIDATION_FAILED` (bad query) · `401 UNAUTHENTICATED` · `403 FORBIDDEN` (not a vendor) ·
`500 INTERNAL`.

---

## POST `/api/quotes/:id/withdraw`

**Role**: owning vendor · **Purpose**: withdraw a submitted quote (FR-011..FR-014).

### Request

Path `id`: uuid. Body: none (an empty JSON object `{}` is accepted; any key ⇒ `400`).

### 200 response

```json
{ "data": { "quote": { "…": "QuoteRecord", "status": "withdrawn" } } }
```

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `id` not a uuid / unexpected body |
| `UNAUTHENTICATED` | 401 | no session |
| `FORBIDDEN` | 403 | not a vendor / no vendor profile |
| `NOT_FOUND` | 404 | quote does not exist or belongs to another vendor (identical body) |
| `CONFLICT` | 409 | `QUOTE_NOT_WITHDRAWABLE` — status is `accepted`, `rejected` or `withdrawn` |
| `INTERNAL` | 500 | unexpected |

**Authorization rule**: `quotes.vendor_id` = caller's vendor id and `status = 'submitted'`,
checked in `withdraw_quote` under a row lock. Request status is never changed.
