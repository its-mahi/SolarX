# Contract: `POST /api/solar/calculate`

**Feature**: 003 · **Overview §8**: listed · **Role**: household · **File**: `src/app/api/solar/calculate/route.ts`

Runs the deterministic estimate. Saves (upserts) the request's estimate, or returns an unsaved
preview. Pipeline: parse JSON → Zod (`calculateRequestSchema`) → authenticate → role = household →
ownership (request readable under RLS) → `buildSolarEstimate` → upsert (save mode only) → envelope.

## Request body (exactly one shape; `.strict()`)

| Mode | Body | Saved? |
|---|---|---|
| Save | `{ "requestId": uuid }` | Yes — upsert on `request_id` |
| Request preview (what-if) | `{ "requestId": uuid, "capacityOverrideKw": number }` | No |
| Inputs preview | `{ "inputs": { "monthlyUnits": number, "monthlyBill"?: int\|null, "budget"?: int\|null, "preferredCapacityKw"?: number\|null }, "capacityOverrideKw"?: number }` | No |

Field rules: see [data-model.md §5](../data-model.md). `capacityOverrideKw` must be within the
rule set's `capacity_range_kw` (1–10 in v1).

## Success `200`

```json
{
  "data": {
    "saved": true,
    "estimate": {
      "requestId": "2b9e…",
      "capacityKw": 3,
      "recommendedCapacityKw": 2.5,
      "capacityBasis": "preferred",
      "installationCost": 180000,
      "subsidyEstimate": 78000,
      "netCost": 102000,
      "annualGenerationKwh": 4200,
      "annualSavingsEstimate": 24360,
      "paybackYears": 4.2,
      "ruleVersion": "pm-surya-ghar.v1",
      "assumptions": {
        "inputs": { "monthlyUnits": 250, "monthlyBill": null, "budget": 150000, "preferredCapacityKw": 3 },
        "annualConsumptionKwh": 3000,
        "generationKwhPerKwYear": 1400,
        "benchmarkCostPerKw": 60000,
        "tariffPerKwh": 7,
        "tariffBasis": "default",
        "selfConsumptionShare": 0.7,
        "exportRatePerKwh": 3,
        "selfConsumedKwh": 2940,
        "exportedKwh": 1260,
        "cfaSlabs": [{ "fromKw": 0, "toKw": 2, "ratePerKw": 30000 }, { "fromKw": 2, "toKw": 3, "ratePerKw": 18000 }],
        "cfaCap": 78000,
        "illustrativeRuleKeys": ["cfa_slabs", "cfa_cap", "generation_kwh_per_kw_year", "…"],
        "notes": ["Estimated upfront cost before subsidy exceeds your stated budget."]
      },
      "updatedAt": "2026-11-01T10:00:00Z"
    },
    "disclaimer": "Estimates only. Subsidy eligibility, approval and payment are decided under the official PM Surya Ghar scheme; SURYAMIT does not guarantee them."
  }
}
```

Preview responses have `"saved": false`, `capacityBasis: "preview"` when an override is used, and
no `updatedAt`. `paybackYears` is `null` when `annualSavingsEstimate` is 0.

## Errors (shared envelope)

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body not JSON, wrong shape, unknown keys, out-of-range values (`details` lists `{ path, message }`) |
| `UNAUTHENTICATED` | 401 | No session |
| `FORBIDDEN` | 403 | Signed-in user is not a household |
| `NOT_FOUND` | 404 | `requestId` does not exist or is not owned by the caller (invisible under RLS) |
| `CONFLICT` | 409 | Request has no `monthly_units` yet ("Enter monthly consumption to calculate an estimate") |
| `INTERNAL` | 500 | Unexpected failure; message is generic, no SQL/stack |

## Authorization rule

Caller must be an authenticated `household` and `household_requests.user_id = auth.uid()` for
the request. The upsert uses the admin client only after this check; RLS has no write policy for
`solar_estimates`, so the browser can never write estimate values.

## Example

```text
POST /api/solar/calculate   {"requestId":"2b9e…","capacityOverrideKw":5}
→ 200 {"data":{"saved":false,"estimate":{"capacityKw":5,"subsidyEstimate":78000,"capacityBasis":"preview",…}}}
POST /api/solar/calculate   {"inputs":{"monthlyUnits":-5}}
→ 400 {"error":{"code":"VALIDATION_FAILED","message":"Some fields are invalid.","details":[{"path":"inputs.monthlyUnits","message":"Must be greater than 0"}]}}
```
