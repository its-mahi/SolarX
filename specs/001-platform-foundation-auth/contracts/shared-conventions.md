# Contract: Shared API Conventions and Server Modules

Owner: 001. Binding for every Route Handler in features 002–011. Values are exactly those of
overview §8; this file adds the module interfaces that implement them.

## Response envelope

Success:

```json
{ "data": { } }
```

Error:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Human-readable text", "details": [] } }
```

`details` is always an array. For validation failures each item is
`{ "path": "field.subfield", "message": "…" }`. For other codes it is usually empty.

## Error codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body/query/params fail Zod, malformed JSON, unexpected keys, business-rule input errors |
| `UNAUTHENTICATED` | 401 | No valid session or bearer token |
| `FORBIDDEN` | 403 | Wrong role; cross-site mutation; demo access disabled is **not** this (see NOT_FOUND) |
| `NOT_FOUND` | 404 | Record absent **or** not visible to caller (prefer over 403 when existence would leak) |
| `CONFLICT` | 409 | Invalid status transition, duplicate (e.g. already accepted), unique violation |
| `PAYLOAD_TOO_LARGE` | 413 | Upload over the size limit |
| `AI_UNAVAILABLE` | 503 | AI provider failure/timeout (008+) |
| `INTERNAL` | 500 | Anything unexpected; message is always generic |

Messages never contain stack traces, SQL, Postgres error text, provider output or secrets.

## Request processing order (every handler)

`parse → validate (Zod, .strict()) → authenticate → authorize (role + ownership) → act → respond`.
Cookie-authenticated `POST`/`PATCH`/`DELETE` additionally pass `assertSameOrigin()`.

## Module interfaces

Signatures are TypeScript-style descriptions; implementations are in the listed files.

### `src/lib/api/errors.ts`

- `type ErrorCode = 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE' | 'AI_UNAVAILABLE' | 'INTERNAL'`
- `const HTTP_STATUS: Record<ErrorCode, number>`
- `class ApiError extends Error { code: ErrorCode; details: ErrorDetail[] }` — constructor
  `(code, message, details?)`
- `toErrorResponse(err: unknown): Response` — maps `ApiError`, `ZodError`, JSON `SyntaxError`,
  Postgres error `23505` (→ `CONFLICT`); everything else → `INTERNAL` and a `logEvent('api.internal_error')`.

### `src/lib/api/respond.ts`

- `ok<T>(data: T, init?: ResponseInit): Response` → `200 { data }` (headers such as
  `Cache-Control` may be passed in `init`)
- `created<T>(data: T, init?: ResponseInit): Response` → `201 { data }`
- `fail(code: ErrorCode, message: string, details?: ErrorDetail[]): Response`
- `withApiHandler(handler: (req: Request, ctx) => Promise<Response>)` — wraps try/catch → `toErrorResponse`
- `parseJsonBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>>` — throws
  `ApiError('VALIDATION_FAILED')` on bad JSON or schema failure

### `src/lib/api/auth-guard.ts` (server-only)

- `requireUser(req: Request): Promise<{ user: { id: string; email: string }; profile: Profile; supabase: SupabaseClient; authVia: 'cookie' | 'bearer' }>`
  — throws `UNAUTHENTICATED` when no session, or when the account has no profile row.
- `requireRole(req: Request, role: 'household' | 'vendor')` — as above, throws `FORBIDDEN` for
  another role. For vendors, also returns `vendor: Vendor`.
- `requirePageRole(role)` — for server layouts/pages: redirects anonymous to
  `/login?next=<current path>` and wrong role to `homePathForRole(actualRole)`.
- `assertSameOrigin(req: Request, authVia)` — for cookie auth on mutating methods, throws
  `FORBIDDEN` when `Origin` is missing or not the app origin.

The returned `supabase` client carries the caller's JWT, so RLS applies to every query made with
it. The admin client (`src/lib/supabase/admin.ts`) is used only where a feature's plan justifies
it (e.g. creating signed URLs after an explicit authorization check).

### `src/lib/api/log.ts` (server-only)

- `logEvent(event: string, fields?: Record<string, unknown>)` — JSON line; keeps only allowlisted
  keys `userId, role, requestId, quoteId, fromStatus, toStatus, code, demoKey, reason`.
  Event naming: `<area>.<action>` e.g. `auth.signup`, `auth.demo_signin`, `request.published`.

### `src/lib/validation/enums.ts`

```text
ROLES                    = ['household', 'vendor']
REQUEST_STATUSES         = ['draft', 'open', 'quoted', 'accepted', 'closed']
QUOTE_STATUSES           = ['submitted', 'accepted', 'rejected', 'withdrawn']
VERIFICATION_STATUSES    = ['unverified', 'demo']
QUOTE_SOURCES            = ['manual', 'ai_extracted']
ROOF_ASSESSMENT_STATUSES = ['completed', 'failed']
```

Each exported as a `readonly` tuple plus a `z.enum(...)` schema and a TS union type
(`Role`, `RequestStatus`, `QuoteStatus`, …). Later features import these; they never re-declare
the literals.

### `src/lib/validation/common.ts`

`uuidSchema`, `inrAmountSchema`, `kwCapacitySchema`, `latitudeSchema`, `longitudeSchema`,
`indianPhoneSchema`, `trimmedText(min, max)` — see [data-model.md](../data-model.md).

## Authentication for API clients

- Browser: Supabase session cookies (set by sign-in/sign-up/demo flows).
- Tests and tools: `Authorization: Bearer <access_token>` header (no Origin check required).
