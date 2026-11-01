# Contract: `POST /api/quotes/compare`

**Feature**: 006 · **Overview §8**: listed · **Role**: owner household ·
**File**: `src/app/api/quotes/compare/route.ts`

Validates, normalizes, flags and scores all non-withdrawn quotes of a request, saves one
`quote_reviews` row per compared quote, and returns them in code-determined order.
Pipeline: parse → Zod (`compareQuotesRequestSchema`) → authenticate → role household →
ownership → load quotes → `normalizeQuote` → `toScoringInput` → `scoreQuotes` + `computeFlags`
→ estimates (003) → `buildExplanation` → upsert reviews (admin client) → envelope.

## Request body (`.strict()`)

```json
{ "requestId": "2b9e…" }
```

## Success `200`

```json
{
  "data": {
    "requestId": "2b9e…",
    "requestStatus": "quoted",
    "scoringVersion": "scoring.v1",
    "weights": { "price": 30, "technical": 25, "warranty": 20, "completeness": 15, "timeline": 10 },
    "disclaimer": "Comparison score defined by SolarX for guidance only — not a government, official or certification rating.",
    "ruleVersion": "pm-surya-ghar.v1",
    "compared": [
      {
        "rank": 2, "tied": false,
        "quoteId": "a1…", "status": "submitted",
        "vendor": { "id": "v1…", "companyName": "SunRise Energy", "isDemo": true },
        "normalized": { "…": "see request-quotes.md" },
        "platformEstimates": { "subsidyEstimate": 78000, "netCostEstimate": 87000, "ruleVersion": "pm-surya-ghar.v1" },
        "missingFields": [],
        "flags": [{ "code": "ABOVE_BUDGET", "severity": "info", "message": "Price is above your stated budget of ₹1,50,000." }],
        "scoreBreakdown": {
          "version": "scoring.v1",
          "parts": {
            "price": { "points": 28.4, "max": 30, "reason": "Price per kW ₹50,000 is 6% above the lowest (₹47,333)." },
            "technical": { "points": 25, "max": 25, "items": [] },
            "warranty": { "points": 19, "max": 20, "items": [] },
            "completeness": { "points": 15, "max": 15, "stated": 14, "total": 14 },
            "timeline": { "points": 6.9, "max": 10, "days": 21 }
          },
          "penalties": [],
          "total": 94.3,
          "comparison": { "rank": 2, "comparedCount": 3, "tied": false, "comparedQuoteIds": ["a1…", "b2…", "c3…"] }
        },
        "totalScore": 94.3,
        "explanation": "Rank 2 of 3. Price per kW 6% above the lowest. All recommended details provided."
      }
    ],
    "excluded": [
      { "quoteId": "d4…", "status": "withdrawn", "reason": "withdrawn" },
      { "quoteId": "e5…", "status": "submitted", "reason": "invalid", "flags": [{ "code": "INVALID_QUOTE", "severity": "warning", "message": "Price or capacity is missing or not positive." }] }
    ]
  }
}
```

`compared` is sorted by: `totalScore` desc → `pricePerKw` asc → `submittedAt` asc → `quoteId` asc.
Zero compared quotes → `200` with `compared: []` (UI empty state). Single quote →
`parts.price.notCompared = true`.

## Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Missing/invalid `requestId`, unknown keys |
| `UNAUTHENTICATED` | 401 | No session |
| `FORBIDDEN` | 403 | Caller is a vendor |
| `NOT_FOUND` | 404 | Request missing or not owned by caller |
| `INTERNAL` | 500 | Unexpected; generic message |

## Authorization rule

As `GET /api/requests/:id/quotes`. Reviews are written only by this route (admin client after the
check); RLS has no write policies on `quote_reviews`.

## Determinism guarantees (tested)

- Same quotes + same `scoring.v1` ⇒ byte-identical `compared` array (excluding timestamps).
- Shuffled DB return order ⇒ same output.
- Changing `vendor_notes`, `other_inclusions`, `exclusions` or vendor name ⇒ same scores and order.
