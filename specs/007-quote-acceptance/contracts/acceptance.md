# Contract: Quote acceptance endpoints

Pipeline for every route: parse → Zod (`.strict()`) → `requireRole` (001) → `assertSameOrigin`
for cookie-authenticated POST → call the SECURITY DEFINER function with the caller's JWT client →
map errors (`src/app/api/quotes/_lib/map-acceptance-db-error.ts`, research R-05) → `ok()`.

---

## `POST /api/quotes/:id/accept`

**Overview §8**: listed · **Role**: owner household · **File**: `src/app/api/quotes/[id]/accept/route.ts`

### Request

- Path `id`: uuid.
- Body (strict): `{ "confirmed": true }`.

### Success `200`

```json
{
  "data": {
    "acceptance": { "id": "f1…", "quoteId": "a1…", "requestId": "2b9e…", "householdId": "h1…", "acceptedAt": "2026-11-01T11:02:03Z" },
    "quote": { "id": "a1…", "status": "accepted" },
    "request": { "id": "2b9e…", "status": "accepted" },
    "rejectedQuoteIds": ["b2…", "c3…"]
  }
}
```

### Errors

| Code | HTTP | `details[0].reason` | When |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | — | `id` not uuid; body missing/`confirmed` not `true`; extra keys |
| `UNAUTHENTICATED` | 401 | — | no session |
| `FORBIDDEN` | 403 | — | caller is a vendor; cross-origin cookie POST |
| `NOT_FOUND` | 404 | `QUOTE_NOT_FOUND` | quote missing, or its request is not owned by the caller |
| `CONFLICT` | 409 | `ALREADY_ACCEPTED` | request already accepted/closed, or lost a concurrent race (incl. `23505`) |
| `CONFLICT` | 409 | `REQUEST_NOT_ACCEPTING` | request not `open`/`quoted` |
| `CONFLICT` | 409 | `QUOTE_NOT_ACCEPTABLE` | quote `withdrawn`, `rejected` or `accepted` |
| `INTERNAL` | 500 | — | unexpected |

### Authorization rule

Authenticated `household` whose `auth.uid()` equals `household_requests.user_id` of the quote's
request — enforced inside `accept_quote` under a row lock (and by `requireRole` for the role).

### Example

```text
POST /api/quotes/a1…/accept {"confirmed":true}   → 200 (first)
POST /api/quotes/c3…/accept {"confirmed":true}   → 409 {"error":{"code":"CONFLICT","message":"This request already has an accepted quote.","details":[{"reason":"ALREADY_ACCEPTED"}]}}
```

---

## `GET /api/quotes/:id/contact` — **Extension to overview §8**

**Role**: vendor (owner of the accepted quote) · **File**: `src/app/api/quotes/[id]/contact/route.ts`

### Request

Path `id`: uuid. No body. Response header `Cache-Control: no-store`.

### Success `200`

```json
{
  "data": {
    "requestId": "2b9e…",
    "name": "Sharma Residence (Demo)",
    "phone": "+91 90000 00000",
    "addressText": "Demo address, Hyderabad, Telangana",
    "latitude": 17.385044,
    "longitude": 78.486671,
    "locality": "Hyderabad",
    "acceptedAt": "2026-11-01T11:02:03Z"
  }
}
```

### Errors

| Code | HTTP | reason | When |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | — | `id` not uuid |
| `UNAUTHENTICATED` | 401 | — | no session |
| `FORBIDDEN` | 403 | — | caller is a household; vendor profile missing |
| `NOT_FOUND` | 404 | `QUOTE_NOT_FOUND` | quote missing or belongs to another vendor |
| `FORBIDDEN` | 403 | `CONTACT_NOT_AVAILABLE` | own quote not accepted ("Contact details are shared only after the household accepts your quote.") |
| `INTERNAL` | 500 | — | unexpected |

### Authorization rule

Caller's `vendors.id` = `quotes.vendor_id`, `quotes.status = 'accepted'`, and a
`quote_acceptances` row exists for the quote — enforced inside `accepted_household_contact`.
The route logs `contact.revealed` with ids only.

---

## Additive field on `GET /api/requests/:id/quotes` (006)

007 adds `acceptance` (from `household_acceptance_summary`) to 006's owner-only response:

```json
{
  "data": {
    "requestId": "2b9e…",
    "requestStatus": "accepted",
    "quotes": ["…"],
    "counts": { "total": 3, "active": 3, "withdrawn": 0 },
    "acceptance": {
      "quoteId": "a1…",
      "acceptedAt": "2026-11-01T11:02:03Z",
      "vendor": { "companyName": "SunRise Energy", "isDemo": true, "phone": "+91 90000 00001" },
      "price": 165000,
      "capacityKw": 3.3
    }
  }
}
```

`acceptance` is `null` when the request has no acceptance. Authorization unchanged (owner
household only).
