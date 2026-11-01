# Contract: `POST /api/requests/:id/close` — **Extension to overview §8**

**Feature**: 007 (D-10) · **Role**: owner household · **File**: `src/app/api/requests/[id]/close/route.ts`

Moves an accepted request to `closed` (read-only). Calls `close_request(p_request_id)` with the
caller's JWT client.

## Request

- Path `id`: uuid.
- Body (strict): `{ "confirmed": true }`.

## Success `200`

```json
{ "data": { "request": { "id": "2b9e…", "status": "closed", "updatedAt": "2026-11-02T08:00:00Z" } } }
```

## Errors

| Code | HTTP | reason | When |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | — | bad id, missing `confirmed: true`, extra keys |
| `UNAUTHENTICATED` | 401 | — | no session |
| `FORBIDDEN` | 403 | — | caller is a vendor; cross-origin cookie POST |
| `NOT_FOUND` | 404 | `REQUEST_NOT_FOUND` | missing or not owned by caller |
| `CONFLICT` | 409 | `REQUEST_NOT_CLOSABLE` | status is not `accepted` (incl. already `closed`) |
| `INTERNAL` | 500 | — | unexpected |

## Authorization rule

Authenticated `household`, `household_requests.user_id = auth.uid()`, status `accepted` — checked
inside `close_request` under `FOR UPDATE`.

## Example

```text
POST /api/requests/2b9e…/close {"confirmed":true}  (request quoted)
→ 409 {"error":{"code":"CONFLICT","message":"Only an accepted request can be closed.","details":[{"reason":"REQUEST_NOT_CLOSABLE"}]}}
```
