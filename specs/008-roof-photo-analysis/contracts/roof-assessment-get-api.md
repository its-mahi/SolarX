# Contract: `GET /api/requests/:id/roof-assessment`

**Owner**: 008 · **Role**: owner household · **Catalogue**: **Extension to overview §8** (see research R-10, R-12)
**Route file**: `src/app/api/requests/[id]/roof-assessment/route.ts`

Returns what the roof panel needs to render its state after a page load.

## Request

Path param `id` — Zod `z.string().uuid()` → `400 VALIDATION_FAILED`.

## Processing

Authenticate → role `household` (else 403) → load request via user-scoped client (RLS; not
visible → 404) → select from `roof_assessments` where `request_id = :id` ordered by
`created_at desc` (RLS select policy applies) → build response.

## 200 OK

```json
{
  "data": {
    "request": {
      "has_roof_photo": true,
      "ai_consent": true,
      "analyzable": true
    },
    "latest_completed": { "...": "RoofAssessmentDto (see roof-analyze-api.md) or null" },
    "latest_attempt": {
      "id": "uuid",
      "status": "failed",
      "created_at": "2026-11-01T10:05:00Z"
    }
  }
}
```

- `latest_completed`: newest `completed` row, as `RoofAssessmentDto` (includes `is_current_photo`), or `null`.
- `latest_attempt`: newest row of any status as `{ id, status, created_at }`, or `null`.
- `request.analyzable`: `status ∈ {draft, open, quoted}`.
- The panel shows the unavailable notice when `latest_attempt.status === 'failed'`.

## Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `id` not a UUID |
| 401 | `UNAUTHENTICATED` | no session |
| 403 | `FORBIDDEN` | caller is a vendor |
| 404 | `NOT_FOUND` | request missing or not owned |

## Tests

`tests/integration/roof/roof-assessment-get-route.test.ts`: authz (401/403/404); empty
(`null`/`null`); completed then failed → `latest_completed` = completed, `latest_attempt.status` =
`failed`; photo replaced → `is_current_photo = false`.
