# Contract: `GET /api/requests/:id/quotes`

**Feature**: 006 · **Overview §8**: listed (renamed from `/api/quotes/:requestId`, D-04) ·
**Role**: owner household · **File**: `src/app/api/requests/[id]/quotes/route.ts`

Lists all quotes on a request in normalized form, with per-quote platform estimates. Does not
score (scoring is relative and done by `POST /api/quotes/compare`). Used by the household
dashboard/request page (002) for "incoming quotes" and by the comparison page's initial render.

## Request

Path `id`: uuid (Zod `z.string().uuid()`). No body; no query parameters.

## Success `200`

```json
{
  "data": {
    "requestId": "2b9e…",
    "requestStatus": "quoted",
    "quotes": [
      {
        "quoteId": "a1…",
        "vendor": { "id": "v1…", "companyName": "SunRise Energy", "isDemo": true },
        "status": "submitted",
        "submittedAt": "2026-11-01T09:10:00Z",
        "normalized": { "price": 165000, "capacityKw": 3.3, "pricePerKw": 50000, "panel": { "brand": "Demo SunCell", "model": "SC-550M", "wattage": 550, "quantity": 6, "certifications": ["BIS certified", "ALMM listed"], "computedCapacityKw": 3.3 }, "inverter": { "brand": "Demo InvertaGrid", "model": "IG-3K", "type": "on-grid", "capacityKw": 3 }, "warranty": { "panelProductYears": 12, "panelPerformanceYears": 25, "inverterYears": 8, "workmanshipYears": 5 }, "installationDays": 21, "earthingIncluded": true, "documentationIncluded": true, "vendorText": { "otherInclusions": ["mounting structure", "DC/AC cabling", "lightning arrester", "net-metering support"], "exclusions": null, "notes": "GST included, 40/50/10 milestones" }, "source": "manual" },
        "platformEstimates": { "subsidyEstimate": 78000, "netCostEstimate": 87000, "ruleVersion": "pm-surya-ghar.v1" }
      }
    ],
    "counts": { "total": 4, "active": 3, "withdrawn": 1 }
  }
}
```

**Additive field from 007**: once 007 is implemented the response also carries
`"acceptance": null | { … }` (see `specs/007-quote-acceptance/contracts/acceptance.md`). 006 clients
must ignore unknown fields.

Order: `submittedAt` asc, then `quoteId`. Withdrawn quotes included with `status: "withdrawn"`
(UI shows them separately).

## Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `id` not a uuid |
| `UNAUTHENTICATED` | 401 | No session |
| `FORBIDDEN` | 403 | Caller is a vendor |
| `NOT_FOUND` | 404 | Request missing or not owned by caller |
| `INTERNAL` | 500 | Unexpected; generic message |

## Authorization rule

Authenticated `household` AND `household_requests.user_id = auth.uid()` (checked in the route via
the user-scoped client; RLS on `quotes`/`household_requests` enforces the same).

## Example

```text
GET /api/requests/2b9e…/quotes   (vendor session)
→ 403 {"error":{"code":"FORBIDDEN","message":"Only the household that owns this request can view its quotes.","details":[]}}
```
