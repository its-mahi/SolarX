# Contract: Roof Photo Upload API

| Method | Path | Role | Feature |
|---|---|---|---|
| POST | `/api/requests/:id/photo` | owner household | 002 (overview §8) |

Uploads or replaces the single roof photo of a **draft** request.

## Request

- `Content-Type: multipart/form-data`, one field `file` (binary). Any other field →
  `VALIDATION_FAILED`.
- The browser sends a JPEG already resized to ≤ 2048 px (see research R-04), but the server
  accepts any allowed type within limits.
- Route runtime: Node.js (`export const runtime = 'nodejs'`).

## Server processing order

1. `requireRole('household')`, `assertSameOrigin`, `id` is a UUID.
2. Load request with the RLS-bound client → `NOT_FOUND` if absent; `CONFLICT` if not `draft`.
3. Read `file`: missing → `VALIDATION_FAILED` "Choose a photo to upload"; size > 5,242,880 bytes
   → `PAYLOAD_TOO_LARGE` "Photo must be 5 MB or smaller".
4. Sniff magic bytes (JPEG / PNG / WebP) → else `VALIDATION_FAILED` "Upload a JPEG, PNG or WebP
   photo". Client MIME type and filename are ignored.
5. `sharp`: auto-rotate, fit inside 2048×2048, re-encode in the sniffed format, metadata stripped.
   Decode error → `VALIDATION_FAILED` "This image could not be read".
6. Upload to `roof-photos/{user_id}/{request_id}/{uuid}.{ext}` with the RLS-bound client.
7. Conditional row update `roof_photo_path = <key> WHERE id = :id AND status = 'draft'`; zero
   rows → delete the new object, `CONFLICT`.
8. Best-effort delete of the previous object (if any).
9. Return the updated DTO with a fresh signed URL.

## Response `200`

```json
{
  "data": {
    "id": "6f1c…",
    "status": "draft",
    "has_roof_photo": true,
    "roof_photo_url": "https://…/object/sign/roof-photos/…",
    "roof_photo_url_expires_at": "2026-11-01T10:20:00Z",
    "missing_publish_fields": ["monthly_units", "budget"],
    "…": "other HouseholdRequestDto fields"
  }
}
```

## Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | no file, wrong type, undecodable image, extra fields, bad id |
| `UNAUTHENTICATED` | 401 | no session |
| `FORBIDDEN` | 403 | vendor caller, cross-site request |
| `NOT_FOUND` | 404 | not owner / unknown id |
| `CONFLICT` | 409 | request not `draft` (incl. published between steps 2 and 7) |
| `PAYLOAD_TOO_LARGE` | 413 | file > 5 MB |
| `INTERNAL` | 500 | storage unavailable or unexpected failure (generic message) |

**Authorization rule**: owner household only; additionally enforced by `storage.objects`
policies (folder 1 = `auth.uid()`, folder 2 = a draft request of the caller).

**Privacy**: stored image carries no EXIF/XMP (no GPS, device or timestamp); the photo is never
sent to any AI provider by this feature.

**Log**: `request.photo_uploaded { requestId }` (no file names, sizes or paths).

## Example

```bash
curl -X POST http://localhost:3000/api/requests/6f1c…/photo \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@roof.jpg;type=image/jpeg"
```
