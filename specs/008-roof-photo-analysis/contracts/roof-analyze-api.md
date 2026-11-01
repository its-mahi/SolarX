# Contract: `POST /api/roof/analyze`

**Owner**: 008 · **Role**: owner household · **Catalogue**: overview §8 (listed)
**Route file**: `src/app/api/roof/analyze/route.ts` · **Runtime**: Node.js · `maxDuration` ≥ 35 s

Runs one synchronous roof analysis for a request the caller owns and stores the attempt.

## Request

`Content-Type: application/json`

```json
{ "request_id": "6f1c…-uuid" }
```

Zod (`src/lib/validation/roof.ts` → `RoofAnalyzeRequestSchema`): `{ request_id: z.string().uuid() }`,
unknown keys rejected.

## Processing order (all server-side)

1. Parse JSON and validate → `400 VALIDATION_FAILED`.
2. Authenticate (001 auth guard) → `401 UNAUTHENTICATED`.
3. Role must be `household` → `403 FORBIDDEN`.
4. Load `household_requests` row with the user-scoped client (RLS) → not visible → `404 NOT_FOUND`.
5. `status ∈ {draft, open, quoted}` → else `409 CONFLICT` (`reason: "request_not_analyzable"`).
6. `ai_consent = true` → else `403 FORBIDDEN` (`reason: "ai_consent_required"`). **No storage read and no AI call happen before this check.**
7. `roof_photo_path` present → else `409 CONFLICT` (`reason: "roof_photo_missing"`).
8. Download the object from bucket `roof-photos` with the user-scoped storage client; verify magic
   bytes ∈ JPEG/PNG/WebP and size ≤ 5 MB → else `400 VALIDATION_FAILED`
   (`reason: "roof_photo_unsupported"`); download failure → `404 NOT_FOUND`
   (`reason: "roof_photo_missing"`).
9. `analyzeRoofPhoto({ bytes, mimeType })` → shared AI client (vision, no fallback).
10. Insert one `roof_assessments` row (`completed` or `failed`) with `model`, `prompt_version`,
    `roof_photo_path`, `failure_reason`.
11. Respond.

## Responses

### 201 Created — analysis completed

```json
{
  "data": {
    "assessment": {
      "id": "uuid",
      "request_id": "uuid",
      "status": "completed",
      "observations": [
        { "object": "water tank", "description": "Visible near the roof edge",
          "potential_impact": "possible shading or space restriction", "confidence": "medium" }
      ],
      "potential_obstructions": ["water tank"],
      "limitations": [
        "A single image cannot establish exact roof dimensions",
        "Shading at different times of day is unknown",
        "Structural condition cannot be assessed"
      ],
      "site_survey_required": true,
      "model": "<configured model id>",
      "prompt_version": "roof-analysis.v1",
      "is_current_photo": true,
      "created_at": "2026-11-01T10:00:00Z"
    }
  }
}
```

`RoofAssessmentDto` (Zod, `src/lib/validation/roof.ts`) — `failure_reason` and the storage path are
**not** returned; `is_current_photo` is computed.

### 503 AI_UNAVAILABLE — AI stage failed (a `failed` row was stored)

```json
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "Analysis unavailable — retry",
    "details": [{ "reason": "timeout", "retryable": true, "assessment_id": "uuid" }]
  }
}
```

`reason ∈ timeout | rate_limited | provider_error | invalid_output | not_configured`. Never contains
provider text.

### Errors (no row stored)

| HTTP | Code | When | `details[0].reason` |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | bad body; photo type/size invalid | field issues / `roof_photo_unsupported` |
| 401 | `UNAUTHENTICATED` | no session | — |
| 403 | `FORBIDDEN` | caller is a vendor | `role_not_allowed` |
| 403 | `FORBIDDEN` | `ai_consent` is not `true` | `ai_consent_required` |
| 404 | `NOT_FOUND` | request missing or not owned; photo object missing | — / `roof_photo_missing` |
| 409 | `CONFLICT` | status `accepted`/`closed` | `request_not_analyzable` |
| 409 | `CONFLICT` | no `roof_photo_path` | `roof_photo_missing` |
| 500 | `INTERNAL` | DB insert failed | — |

## Side effects and logging

- Exactly one row per call that reaches step 9; zero rows otherwise.
- Log line: `roof_analysis` outcome, failure kind, model, prompt version, duration. No request id
  combined with user data, no photo bytes, no path.

## Tests (must exist before implementation)

`tests/integration/roof/analyze-route.test.ts`: 401; vendor 403; other household 404; consent
false → 403 and `mock.calls.length === 0` and no row; accepted → 409; no photo → 409; each AI
failure kind → 503 + `failed` row; malformed output → 503 + `failed` row with empty arrays;
success → 201 + row with `model`/`prompt_version`; over-reaching output → extra keys absent; the
request remains publishable after a failure (call 002's publish handler).
