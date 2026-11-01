# Contract: Vendor branch of the request endpoints

**Feature**: `004-vendor-request-discovery` · Envelope and codes: overview §8.
Both endpoints are shared with `002-household-solar-request` (household branch). This file defines
only the behaviour when the caller's profile role is `vendor`. Field names are `snake_case`.

Common rules:

- Auth: Supabase session cookie. No session ⇒ `401 UNAUTHENTICATED`.
- Role switch: `profile.role === 'household'` ⇒ 002 behaviour (unchanged); `'vendor'` ⇒ this
  contract.
- Authorization: server role check **and** DB functions `vendor_list_open_requests` /
  `vendor_get_open_request` (data-model §2) that raise `42501` for non-vendors (mapped to `403`).
- Responses never contain `address_text`, exact coordinates, `user_id`, `name`, `phone`,
  `monthly_bill`, `ai_consent` or `roof_photo_path`.
- Errors: `{ "error": { "code", "message", "details": [] } }`; no stack traces, SQL or paths.

---

## GET `/api/requests` (vendor)

**Role**: vendor · **Purpose**: list `open`/`quoted` requests (approximate data only).

### Query parameters (`vendorRequestFiltersSchema`)

| Name | Type | Required | Rule |
|---|---|---|---|
| `max_distance_km` | number \| `any` | no | `0 < x ≤ 500`; default = vendor `service_radius_km` when base location known |
| `locality` | string | no | 1–100 chars, case-insensitive contains |
| `min_capacity_kw` / `max_capacity_kw` | number | no | `0–100`, `min ≤ max`, inclusive; excludes null capacity when set |
| `min_budget` / `max_budget` | integer | no | `0–10000000`, `min ≤ max`, inclusive |
| `sort` | `distance` \| `newest` | no | default `distance` if vendor base known, else `newest` |

### 200 response

```json
{
  "data": {
    "items": [
      {
        "id": "6f1c…",
        "status": "open",
        "locality": "Kondapur, Hyderabad",
        "approx_latitude": 17.46,
        "approx_longitude": 78.36,
        "distance_km": 4,
        "within_service_area": true,
        "monthly_units": 250,
        "budget": 150000,
        "preferred_capacity_kw": 3,
        "has_roof_photo": true,
        "is_demo": true,
        "created_at": "2026-11-01T09:30:00Z"
      }
    ],
    "vendor_context": {
      "service_area": "Hyderabad West",
      "base_latitude": 17.44,
      "base_longitude": 78.38,
      "service_radius_km": 25
    },
    "applied_filters": { "max_distance_km": 25, "sort": "distance" },
    "truncated": false
  }
}
```

- `items` ≤ 200; `truncated: true` when more matched.
- `vendor_context` is `null` if the vendor has no `vendors` row; its base fields are `null` if not
  set (then `distance_km`/`within_service_area` are `null`).

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | malformed filter; `details: [{ "path": "min_budget", "message": "must be ≤ max_budget" }]` |
| `UNAUTHENTICATED` | 401 | no session |
| `FORBIDDEN` | 403 | DB guard rejects caller (role mismatch) |
| `INTERNAL` | 500 | unexpected failure (generic message) |

---

## GET `/api/requests/:id` (vendor)

**Role**: vendor · **Purpose**: permitted detail view of one `open`/`quoted` request.

### Path parameters

| Name | Type | Rule |
|---|---|---|
| `id` | uuid | Zod `uuid()`; malformed ⇒ `400` |

### 200 response

```json
{
  "data": {
    "id": "6f1c…",
    "status": "quoted",
    "locality": "Kondapur, Hyderabad",
    "approx_latitude": 17.46,
    "approx_longitude": 78.36,
    "distance_km": 4,
    "within_service_area": true,
    "monthly_units": 250,
    "budget": 150000,
    "preferred_capacity_kw": 3,
    "has_roof_photo": true,
    "is_demo": true,
    "created_at": "2026-11-01T09:30:00Z",
    "roof_photo_status": "available",
    "roof_photo": {
      "url": "https://<project>.supabase.co/storage/v1/object/sign/roof-photos/…?token=…",
      "expires_at": "2026-11-01T10:10:00Z"
    },
    "roof_assessment": {
      "observations": [
        { "object": "water tank", "description": "Visible near the roof edge", "potential_impact": "possible shading or space restriction", "confidence": "medium" }
      ],
      "potential_obstructions": ["water tank"],
      "limitations": ["A single image cannot establish exact roof dimensions"],
      "site_survey_required": true,
      "assessed_at": "2026-11-01T09:20:00Z"
    }
  }
}
```

- `roof_photo_status`: `none` (no photo; `roof_photo: null`), `unavailable` (signing failed;
  `roof_photo: null`), `available`. Signed URL expiry is exactly 600 s; a new URL per call.
- `roof_assessment` is `null` when none is completed or feature 008 is not deployed.

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `id` not a uuid |
| `UNAUTHENTICATED` | 401 | no session |
| `FORBIDDEN` | 403 | DB guard rejects caller |
| `NOT_FOUND` | 404 | request is `draft`, `accepted`, `closed` or does not exist (identical body for all) |
| `INTERNAL` | 500 | unexpected failure |

Example 404:

```json
{ "error": { "code": "NOT_FOUND", "message": "This request is not available.", "details": [] } }
```
