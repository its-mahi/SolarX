# Contract: `POST /api/advisor/explain`

**Owner**: 011 · **Catalogue**: overview §8 (owner household) · **Route Handler**:
`src/app/api/advisor/explain/route.ts` · **Schemas**: `src/lib/validation/advisor.ts`

Returns a three-section plain-language explanation of a request's stored results. Read-only:
creates, updates or deletes nothing.

## Pipeline (overview §5 rule 2)

1. Parse JSON → `advisorExplainRequestSchema` → 400.
2. `requireRole(req, "household")` (001) → 401 / 403.
3. `assertSameOrigin(req, authVia)` (001, cookie auth) → 403.
4. `getOwnRequest(supabase, request_id)` (002, RLS-bound) → `null` → 404 (also for other
   households' requests; existence not disclosed).
5. `loadAdvisorInputs` (RLS-bound reads, data-model §1) → `buildAdvisorFacts` → (AI via
   `explainWithAi`) → `validateAdvisorExplanation` → on any failure `buildTemplateExplanation`.
6. `200 { data }` via `src/lib/api/respond.ts`.

## Request

```http
POST /api/advisor/explain
Content-Type: application/json
```

```json
{ "request_id": "6f1c2a8e-1d2b-4c1e-9a77-0c3b2f6d9e10" }
```

## Success — `200 OK`

Example (demo household, AI used; abbreviated):

```json
{
  "data": {
    "request_id": "6f1c2a8e-1d2b-4c1e-9a77-0c3b2f6d9e10",
    "generated_at": "2026-11-01T10:15:00.000Z",
    "source": "ai",
    "ai_status": "used",
    "mode": "compare",
    "sections": {
      "observed": {
        "title": "What I observed", "available": true,
        "summary": "One photo shows a water tank and a staircase room on the terrace.",
        "points": [
          { "text": "A water tank near the edge may shade part of the roof (medium confidence, from one photo).",
            "fact_refs": ["roof.observation.0.object", "roof.observation.0.confidence"] }
        ]
      },
      "calculations": {
        "title": "What the calculations show", "available": true,
        "summary": "An indicative 3 kW system is estimated to cost ₹1,65,000 before subsidy.",
        "points": [
          { "text": "The estimated central subsidy is ₹78,000, so the estimated net cost is ₹87,000.",
            "fact_refs": ["estimate.subsidy_estimate", "estimate.net_cost"] }
        ]
      },
      "recommendation": {
        "title": "What I recommend", "available": true,
        "summary": "Quote A has the highest comparison score (93.2 of 100).",
        "leading_quote_label": "A",
        "points": [
          { "text": "Quote C is the lowest price at ₹1,50,000 but did not state earthing.",
            "fact_refs": ["quote.C.price", "quote.C.missing"] }
        ]
      }
    },
    "limitations": ["Roof observations come from a single photo.", "All amounts are estimates."],
    "disclaimers": [
      { "code": "estimates_only", "text": "All amounts are indicative estimates based on rule version pm-surya-ghar.v1, not quotes or final prices." },
      { "code": "no_subsidy_guarantee", "text": "Subsidy is not guaranteed. …" },
      { "code": "site_survey_required", "text": "A site survey by the installer is required …" },
      { "code": "score_not_official", "text": "Comparison score defined by SolarX for guidance only — …" },
      { "code": "ai_may_err", "text": "Explanations may be written by AI and can be imperfect. …" }
    ],
    "facts": [ { "id": "estimate.net_cost", "section": "calculations", "label": "Estimated net cost", "value": 87000, "unit": "inr", "kind": "estimate" } ],
    "quote_labels": [
      { "label": "A", "quoteId": "…", "vendorDisplayName": "SunRise Energy", "isDemo": true, "status": "submitted", "rank": 1 },
      { "label": "B", "quoteId": "…", "vendorDisplayName": "SolarTech Solutions", "isDemo": true, "status": "submitted", "rank": 2 },
      { "label": "C", "quoteId": "…", "vendorDisplayName": "GreenVolt Solar", "isDemo": true, "status": "submitted", "rank": 3 }
    ]
  }
}
```

(Labels follow submission order; in this example SunRise was submitted first.)

**Degraded** (AI unavailable, not configured, malformed or rejected): same shape, `source:
"template"`, `ai_status` ∈ `unavailable | not_configured | invalid_output | rejected`,
sections built by the template. The UI shows "Standard summary — AI explanation unavailable"
(or "…did not pass our accuracy check") with Retry.

**Empty**: `mode: "no_data"`; sections have `available: false` and summaries telling the next
action (e.g. "Add your usage and budget to see an estimate").

Shapes: [data-model.md](../data-model.md) §5.

## Errors (shared envelope, overview §8)

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | body not JSON, missing/unknown keys, `request_id` not a UUID |
| 401 | `UNAUTHENTICATED` | no session |
| 403 | `FORBIDDEN` | signed-in vendor (non-household role); cookie request from a foreign origin |
| 404 | `NOT_FOUND` | request does not exist **or** belongs to another household |
| 500 | `INTERNAL` | unexpected failure (e.g. DB read error); generic message, no SQL or stack |
| 503 | `AI_UNAVAILABLE` | **not returned by design** — AI failures are answered with `200` + template (research R8, constitution VII) |

Not used: `CONFLICT`, `PAYLOAD_TOO_LARGE`.

## Logging

One line: `{ event: "advisor_explain", mode, source, ai_status, issue_codes, duration_ms }`. No
explanation text, facts, vendor names or request ids beyond 001's default request logging. 008's
client separately logs its own metadata line.

## Timing

AI: 12 s per attempt, aborted at 15 s overall. Template path < 3 s (SC-001).

## Contract tests

`tests/integration/advisor/explain-route-auth.test.ts`, `explain-route-fallback.test.ts`,
`advisor-injection.test.ts` (tasks.md).
