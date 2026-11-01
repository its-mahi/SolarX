# Contract: `POST /api/voice/parse`

**Owner**: 010 · **Catalogue**: overview §8 (household role) · **Route Handler**:
`src/app/api/voice/parse/route.ts` · **Schemas**: `src/lib/validation/voice.ts`

Interprets a speech transcript into candidate values for the four usage/budget fields. Stateless:
it reads and writes **no** database rows and stores nothing.

## Pipeline (overview §5 rule 2)

1. Parse JSON body → `voiceParseRequestSchema` (400 on failure).
2. `requireRole(req, "household")` from 001's `src/lib/api/auth-guard.ts` → 401 if no session,
   403 for another role.
3. `assertSameOrigin(req, authVia)` (001 convention for mutating methods with cookie auth) → 403.
4. Rule parser → (optional) AI parser via 008's client → grounded merge (research R3).
5. Respond with the envelope from `src/lib/api/respond.ts`.

## Request

```http
POST /api/voice/parse
Content-Type: application/json
Cookie: <Supabase session>
```

```json
{
  "transcript": "mera bill do hazaar rupaye aata hai, 250 unit, budget dedh lakh, teen kilowatt chahiye",
  "language": "hi-IN"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `transcript` | string | yes | trimmed, control chars removed, 1–500 chars |
| `language` | `"hi-IN" \| "gu-IN" \| "en-IN"` | yes | |

Unknown keys are rejected.

## Success — `200 OK`

```json
{
  "data": {
    "language": "hi-IN",
    "ai_status": "used",
    "fields": {
      "monthly_units":         { "status": "heard", "value": 250,    "source": "both",  "note": null },
      "monthly_bill":          { "status": "heard", "value": 2000,   "source": "both",  "note": null },
      "budget":                { "status": "heard", "value": 150000, "source": "rules", "note": null },
      "preferred_capacity_kw": { "status": "heard", "value": 3,      "source": "ai",    "note": null }
    }
  }
}
```

Partial / degraded example (AI down, rule parser found two values):

```json
{
  "data": {
    "language": "en-IN",
    "ai_status": "unavailable",
    "fields": {
      "monthly_units":         { "status": "heard",     "value": 250,    "source": "rules", "note": null },
      "monthly_bill":          { "status": "not_heard", "value": null,   "source": null,    "note": null },
      "budget":                { "status": "heard",     "value": 150000, "source": "rules", "note": null },
      "preferred_capacity_kw": { "status": "not_heard", "value": null,   "source": null,    "note": null }
    }
  }
}
```

Field semantics and enums: [data-model.md](../data-model.md) §1, §6.

`200` with all four fields `not_heard` and `ai_status: "used"` or `"skipped"` is a valid
"nothing understood" result (panel shows the empty state).

## Errors (shared envelope, overview §8)

```json
{ "error": { "code": "AI_UNAVAILABLE", "message": "Voice analysis is unavailable right now. Please retry or type your values.", "details": [{ "reason": "timeout", "retryable": true }] } }
```

The 503 body comes from 008's `aiFailureToApiError(failure, message)` (`details[0].reason` is an
`AiFailureKind`); when the provider is not configured, `details` is
`[{ "reason": "not_configured", "retryable": false }]`.

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | body not JSON, missing/unknown keys, transcript empty or > 500 chars, unsupported language; `details` lists Zod issue paths (never echoes the transcript) |
| 401 | `UNAUTHENTICATED` | no valid session |
| 403 | `FORBIDDEN` | signed-in user is not a household, or cookie-authenticated request from a foreign origin |
| 503 | `AI_UNAVAILABLE` | `ai_status` would be `unavailable`, `invalid_output` or `not_configured` **and** all four fields are `not_heard` (nothing useful to return) |
| 500 | `INTERNAL` | unexpected failure; generic message only |

Not used: `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE` (a body over the platform limit is treated
as 400 because the transcript limit is 500 characters).

**Never** included in any response or log: stack traces, provider responses, prompt text,
the transcript.

## Logging

One line per call: `{ event: "voice_parse", ai_status, heard_count, needs_entry_count, duration_ms }`.
No transcript, no values, no user identifiers beyond what 001's logger adds by default.

## Timing

AI call: 8 s per attempt, 10 s overall abort (008 client options). Target total response time ≤ 10 s (SC-006).

## Contract tests

`tests/integration/voice/parse-route.test.ts` (see tasks.md): 200 full, 200 degraded, 503, 400,
401, 403, malformed AI output, ungrounded AI value, injection transcript, no DB/storage access,
transcript absent from logs.
