# Contract: Auth API

**Extensions to overview §8** (new endpoints; no existing path changed):

| Method | Path | Role | Feature |
|---|---|---|---|
| POST | `/api/auth/signup` | anonymous | 001 |
| POST | `/api/auth/demo` | anonymous | 001 |

Sign-in and sign-out are performed by the browser Supabase client (overview §5) and are not
Route Handlers; after sign-in the client calls `GET /api/me` ([me-api.md](me-api.md)) to route.

---

## POST `/api/auth/signup`

Creates an account with a role, its profile and (for vendors) its vendor profile, and starts a
session (cookies set on the response).

**Role**: anonymous (a signed-in caller receives `CONFLICT` "Already signed in").
**Origin**: must be same-origin.

### Request body — `signUpSchema` (strict, discriminated on `role`)

| Field | Type | Rules |
|---|---|---|
| `role` | `"household" \| "vendor"` | required |
| `name` | string | trimmed, 1–100 |
| `email` | string | valid email, lower-cased, ≤ 254 |
| `password` | string | 8–72 characters |
| `phone` | string \| null | optional; Indian mobile; normalized to `+91XXXXXXXXXX` |
| `company_name` | string | vendor only, required, trimmed 2–120 |
| `service_area` | string | vendor only, required, trimmed 2–200 |
| `latitude` | number \| null | vendor only, optional, −90..90; must be paired with `longitude` |
| `longitude` | number \| null | vendor only, optional, −180..180 |
| `service_radius_km` | integer | vendor only, optional, 1–500, default 25 |

Vendor fields sent with `role: "household"` → `VALIDATION_FAILED` (strict schema).

### Response `201`

```json
{
  "data": {
    "profile": { "id": "uuid", "name": "Asha Rao", "role": "household", "is_demo": false },
    "redirect_to": "/household"
  }
}
```

### Errors

| Code | When |
|---|---|
| `VALIDATION_FAILED` | schema failure (details per field); data-layer rejection of role/vendor fields |
| `CONFLICT` | email already registered — message: "We couldn't create an account with these details. If you already have an account, please sign in." ; or caller already signed in |
| `FORBIDDEN` | cross-site request |
| `INTERNAL` | identity service unavailable or unexpected failure |

**Authorization rule**: anonymous only; role validated by Zod and again by `handle_new_user()`.
**Logging**: `auth.signup { userId, role }` on success; `auth.signup_failed { reason }` (no email).

### Example

```http
POST /api/auth/signup
Content-Type: application/json
Origin: https://solarx.example

{ "role": "vendor", "name": "Ravi Kumar", "email": "ravi@example.com", "password": "solar-2026!",
  "company_name": "Ravi Solar Works", "service_area": "Warangal, Telangana", "service_radius_km": 40 }
```

```json
{ "data": { "profile": { "id": "…", "name": "Ravi Kumar", "role": "vendor", "is_demo": false },
            "redirect_to": "/vendor" } }
```

---

## POST `/api/auth/demo`

Signs the caller in as one of the four fictional demo accounts; the password is read from
`DEMO_ACCOUNT_PASSWORD` on the server and never returned.

**Role**: anonymous or signed-in (an existing session is replaced).
**Origin**: must be same-origin.
**Availability**: only when `DEMO_ACCOUNTS_ENABLED=true`; otherwise `NOT_FOUND`.

### Request body — `demoSignInSchema` (strict)

| Field | Type | Rules |
|---|---|---|
| `account` | `"household" \| "sunrise-energy" \| "greenvolt-solar" \| "solartech-solutions"` | required |

### Response `200`

```json
{
  "data": {
    "profile": { "id": "d0000000-0000-4000-8000-000000000001", "name": "Sharma Residence", "role": "household", "is_demo": true },
    "redirect_to": "/household"
  }
}
```

### Errors

| Code | When |
|---|---|
| `VALIDATION_FAILED` | unknown `account` key |
| `NOT_FOUND` | demo access disabled |
| `FORBIDDEN` | cross-site request |
| `INTERNAL` | demo account missing (seed not applied) or sign-in failed — message: "Demo account is unavailable right now. Please try again or sign in." |

**Logging**: `auth.demo_signin { demoKey, userId }`.

### Example

```http
POST /api/auth/demo
Content-Type: application/json

{ "account": "greenvolt-solar" }
```

→ `200 { "data": { "profile": { …, "name": "GreenVolt Solar", "role": "vendor", "is_demo": true }, "redirect_to": "/vendor" } }`

---

## Browser sign-in / sign-out (UI contract, no Route Handler)

- `/login` form validates with `signInSchema` (`email`, `password` 1–72) client-side, calls
  `supabase.auth.signInWithPassword`, then `GET /api/me`, then navigates to
  `safeNextPath(next, role)`.
- Any sign-in error shows "Email or password is incorrect." (identity-service messages are not
  shown).
- Sign-out: `supabase.auth.signOut()` then `router.replace('/')` and `router.refresh()`.
