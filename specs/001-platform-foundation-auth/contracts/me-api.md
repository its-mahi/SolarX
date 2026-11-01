# Contract: Current User API

**Extensions to overview §8** (new endpoints):

| Method | Path | Role | Feature |
|---|---|---|---|
| GET | `/api/me` | any signed-in user | 001 |
| PATCH | `/api/me` | any signed-in user (own record only) | 001 |

## Response schema `Me`

```json
{
  "data": {
    "profile": {
      "id": "uuid",
      "email": "demo-sunrise@example.com",
      "name": "SunRise Energy",
      "phone": "+919000000011",
      "role": "vendor",
      "is_demo": true
    },
    "vendor": {
      "id": "uuid",
      "company_name": "SunRise Energy",
      "service_area": "Hyderabad, Telangana",
      "latitude": 17.4483,
      "longitude": 78.3915,
      "service_radius_km": 30,
      "verification_status": "demo"
    },
    "home_path": "/vendor"
  }
}
```

`vendor` is `null` for households.

---

## GET `/api/me`

Returns the caller's own profile, vendor profile (if any) and role home path.

| Code | When |
|---|---|
| `UNAUTHENTICATED` | no session/token, or account has no profile row |
| `INTERNAL` | unexpected failure |

**Authorization rule**: reads only rows where `id = auth.uid()` / `user_id = auth.uid()` using
the caller's RLS-bound client.

---

## PATCH `/api/me`

Updates the caller's own editable fields. At least one field must be present.

**Origin**: same-origin for cookie auth.

### Request body (strict)

Household — `profileUpdateSchema`:

| Field | Type | Rules |
|---|---|---|
| `name` | string | trimmed 1–100 |
| `phone` | string \| null | Indian mobile or `null` to clear |

Vendor — `vendorProfileUpdateSchema` = the above plus:

| Field | Type | Rules |
|---|---|---|
| `company_name` | string | trimmed 2–120 |
| `service_area` | string | trimmed 2–200 |
| `latitude` / `longitude` | number \| null | ranges as in data-model; both or neither |
| `service_radius_km` | integer | 1–500 |

Any of `role`, `is_demo`, `verification_status`, `id`, `user_id`, `email` in the body →
`VALIDATION_FAILED` (unknown key). A household sending vendor fields → `VALIDATION_FAILED`.

### Response `200` — `Me` (updated)

### Errors

| Code | When |
|---|---|
| `VALIDATION_FAILED` | schema failure, empty body, unknown keys |
| `UNAUTHENTICATED` | no session |
| `FORBIDDEN` | cross-site request; data-layer refusal of a protected column |
| `INTERNAL` | unexpected failure |

**Authorization rule**: update `profiles where id = auth.uid()` and
`vendors where user_id = auth.uid()` with the RLS-bound client; guard triggers additionally
block role/demo/verification changes.

### Example

```http
PATCH /api/me
Content-Type: application/json

{ "service_radius_km": 35, "company_name": "SunRise Energy" }
```

→ `200 { "data": { "profile": { … }, "vendor": { …, "service_radius_km": 35 }, "home_path": "/vendor" } }`
