# Contract: Household Requests API

Endpoints (overview §8, 002 rows; no additions):

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/requests` | household | create draft |
| GET | `/api/requests` | household (own) | vendor branch delivered by 004 |
| GET | `/api/requests/:id` | owner household | vendor branch delivered by 004 |
| PATCH | `/api/requests/:id` | owner household | draft fields; consent withdrawal on non-drafts |
| POST | `/api/requests/:id/publish` | owner household | draft → open |

Photo upload: see [request-photo-api.md](request-photo-api.md). Envelope, error codes and the
guard are defined in `specs/001-platform-foundation-auth/contracts/shared-conventions.md`.
Cookie-authenticated mutations require a same-origin `Origin` header.

## Shared response schema — `HouseholdRequestDto`

```json
{
  "id": "6f1c…",
  "status": "draft",
  "address_text": "Plot 12, Road 3, Banjara Hills, Hyderabad 500034",
  "locality": "Banjara Hills",
  "latitude": 17.412345,
  "longitude": 78.443210,
  "monthly_units": 250,
  "monthly_bill": 2100,
  "budget": 150000,
  "preferred_capacity_kw": 3.0,
  "ai_consent": false,
  "has_roof_photo": true,
  "roof_photo_url": "https://…/object/sign/roof-photos/…?token=…",
  "roof_photo_url_expires_at": "2026-11-01T10:20:00Z",
  "missing_publish_fields": [],
  "next_action": { "kind": "continue", "label": "Continue request", "step": "review" },
  "created_at": "2026-11-01T10:00:00Z",
  "updated_at": "2026-11-01T10:09:00Z"
}
```

Field types: money and units are integers; coordinates numbers (6 dp); `preferred_capacity_kw`
number (1 dp) or `null`; `missing_publish_fields` ⊆
`["location","address_text","locality","monthly_units","budget","roof_photo"]`;
`next_action.kind` ∈ `continue | wait | compare | next_steps | view`; `step` ∈
`location | photo | usage | review` (only for `continue`).

## Request body schema — draft fields (`draftFieldsSchema`, strict)

| Field | Type | Rules |
|---|---|---|
| `latitude` | number \| null | 6.5–37.5; requires `longitude` |
| `longitude` | number \| null | 68–97.5; requires `latitude` |
| `address_text` | string \| null | trimmed 5–300 |
| `locality` | string \| null | trimmed 2–100 |
| `monthly_units` | integer \| null | 1–10000 |
| `monthly_bill` | integer \| null | 0–100000 |
| `budget` | integer \| null | 10000–5000000 |
| `preferred_capacity_kw` | number \| null | 0.5–20, step 0.1 |
| `ai_consent` | boolean | — |

Unknown keys (incl. `status`, `user_id`, `roof_photo_path`, `id`) → `VALIDATION_FAILED`.

---

## POST `/api/requests`

Create a draft owned by the caller.

- **Role**: household. Vendor → `403 FORBIDDEN`. Anonymous → `401`.
- **Body**: `createRequestSchema` (draft fields, all optional; wizard sends the location fields).
- **Response**: `201 { "data": HouseholdRequestDto }` with `status: "draft"`.
- **Errors**: `VALIDATION_FAILED` (field details), `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL`.
- **Authorization**: `requireRole('household')`; insert via RLS-bound client
  (`user_id = auth.uid()`, `status = 'draft'` enforced by policy + trigger).
- **Log**: `request.created { requestId, userId }`.

Example:

```http
POST /api/requests
{ "latitude": 17.412345, "longitude": 78.44321, "address_text": "Plot 12, Road 3, Banjara Hills, Hyderabad 500034", "locality": "Banjara Hills" }
```

→ `201 { "data": { "id": "6f1c…", "status": "draft", "missing_publish_fields": ["monthly_units","budget","roof_photo"], "next_action": { "kind": "continue", "label": "Continue request", "step": "photo" }, … } }`

---

## GET `/api/requests`

- **Household**: own requests, newest first (`created_at DESC`), `roof_photo_url: null` in list
  items. `200 { "data": { "items": HouseholdRequestDto[] } }`. Empty → `items: []`.
- **Vendor**: until 004 ships → `403 FORBIDDEN` "Vendor request discovery is not available yet".
  004 replaces this branch with its approximate-location listing (separate contract in 004).
- **Errors**: `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL`.
- **Authorization**: `requireUser`; household rows filtered by RLS (`user_id = auth.uid()`).

---

## GET `/api/requests/:id`

- **Household owner**: `200 { "data": HouseholdRequestDto }` including a fresh signed
  `roof_photo_url` (600 s) when a photo exists.
- **Other household / missing id**: `404 NOT_FOUND` "Request not found".
- **Vendor**: until 004 ships → `403 FORBIDDEN`; 004 replaces with its permitted view.
- **Params**: `id` must be a UUID → else `VALIDATION_FAILED`.
- **Errors**: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL`.

---

## PATCH `/api/requests/:id`

- **Role**: owner household.
- **Body**:
  - request `draft` → `updateDraftSchema` (≥ 1 draft field). `null` clears an optional/draft
    field.
  - request not `draft` → only `consentWithdrawalSchema` `{ "ai_consent": false }`.
- **Response**: `200 { "data": HouseholdRequestDto }`.
- **Errors**:
  | Code | When |
  |---|---|
  | `VALIDATION_FAILED` | schema failure, empty body, unknown keys |
  | `UNAUTHENTICATED` / `FORBIDDEN` | no session / vendor caller / cross-site |
  | `NOT_FOUND` | not the owner or no such request |
  | `CONFLICT` | non-draft with any field other than `ai_consent: false` → "This request has been published and can no longer be edited"; `ai_consent: true` on non-draft → "Consent can only be given before publishing"; data-layer guard rejection |
- **Log**: `request.ai_consent_changed { requestId, reason: 'granted'|'withdrawn' }` when consent changes.

Example (draft):

```http
PATCH /api/requests/6f1c…
{ "monthly_units": 250, "budget": 150000, "monthly_bill": 2100, "preferred_capacity_kw": 3 }
```

---

## POST `/api/requests/:id/publish`

- **Role**: owner household. Body: none (empty or `{}`; anything else → `VALIDATION_FAILED`).
- **Behaviour**: load (RLS) → status must be `draft` → `getMissingPublishFields()` must be
  empty → conditional update `status = 'open' WHERE status = 'draft'`.
- **Response**: `200 { "data": HouseholdRequestDto }` with `status: "open"`,
  `next_action.kind: "wait"`.
- **Errors**:
  | Code | When |
  |---|---|
  | `VALIDATION_FAILED` | missing items; `details: [{ "path": "roof_photo", "message": "Add a roof photo" }, …]` |
  | `CONFLICT` | status not `draft` or lost the conditional update race — "This request is already published" |
  | `NOT_FOUND` | not owner / unknown id |
  | `UNAUTHENTICATED` / `FORBIDDEN` | as above |
- **Log**: `request.published { requestId, fromStatus: 'draft', toStatus: 'open' }`.

Example error:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Complete the missing items before publishing.",
  "details": [ { "path": "budget", "message": "Enter your budget" }, { "path": "roof_photo", "message": "Add a roof photo" } ] } }
```
