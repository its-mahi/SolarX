# Quickstart: Roof Photo Analysis

Validation guide for 008. Contracts: [ai-client](contracts/ai-client.md) ·
[POST analyze](contracts/roof-analyze-api.md) · [GET latest](contracts/roof-assessment-get-api.md) ·
[output schema](contracts/roof-analysis-output.md) · [panel](contracts/roof-analysis-panel.md).
Data: [data-model.md](data-model.md).

## Prerequisites

- 001 and 002 implemented (sign-in, demo household, wizard with photo upload and AI consent).
- Supabase running (local or project) with migrations applied, including
  `supabase/migrations/20261101000800_roof_assessments.sql`, and `supabase/seed.sql` loaded.
- `.env.local` (server-only values):
  - `GEMINI_API_KEY` = your key; `GEMINI_MODEL` = a vision-capable model that returns JSON —
    **confirm the current model name and free-tier quota on demo day** (research R-01).
  - Optional: `GROQ_API_KEY`, `GROQ_MODEL` (text fallback; not used by roof analysis).
  - Optional: `AI_TIMEOUT_MS` (default 20000), `AI_MAX_RETRIES` (default 1).
- Demo images: `tests/fixtures/roof/clear-roof.jpg`, `tests/fixtures/roof/obstructed-roof.jpg`.

## Automated checks

```bash
npm run test -- tests/unit/ai                      # client, framing, JSON, roof schema
npm run test -- tests/integration/roof             # route handlers + RLS (needs local Supabase)
npm run lint && npm run typecheck
grep -rn "@google/genai\|groq-sdk" src --include=*.ts* | grep -v "src/lib/ai/providers/"   # expect no output (FR-027)
grep -rn "NEXT_PUBLIC_.*\(GEMINI\|GROQ\|AI_\)" .env.example src                          # expect no output
AI_LIVE_TESTS=1 npm run test -- tests/integration/roof/live-smoke   # optional, demo day only
```

Required tests (constitution VI) that must pass: malformed AI JSON rejected and stored as `failed`;
unknown keys (area, capacity, shading hours) never stored or returned; provider timeout / rate limit
/ error → 503 and the request is still publishable; consent off → refused with zero provider
calls; vendor / other household / anonymous refused; RLS blocks cross-household reads and
inserts without consent.

## Manual acceptance checks

1. **Happy path (US1)** — Sign in as the demo household. Create a request, upload
   `obstructed-roof.jpg`, tick AI consent. In the roof panel press **Analyze roof photo**.
   Expect: loading text "this can take up to 30 seconds"; then observations (e.g. water tank,
   staircase room) with "Medium confidence"-style words, obstruction chips, ≥ 3 limitations, the
   site-survey reminder, and "AI observations — not measurements". No area, kW or percentage
   anywhere.
2. **Clear roof** — Replace the photo with `clear-roof.jpg`. Expect the stale-photo notice. Press
   **Analyze current photo**. Expect either few/no observations or "No obvious obstructions were
   visible in this photo", still with limitations and the survey reminder (US5).
3. **Consent gate (US2)** — On a request with consent unticked, open the panel. Expect the consent
   explanation and no Analyze button. With dev tools, `POST /api/roof/analyze` for that request →
   `403 FORBIDDEN` with `ai_consent_required`; no new row in `roof_assessments`.
4. **Authorization** — Sign in as a demo vendor; `POST /api/roof/analyze` → 403. Sign in as a second
   household; same request id → 404. Signed out → 401.
5. **Failure (US3)** — Set `GEMINI_MODEL` to an invalid value (or remove `GEMINI_API_KEY`), restart,
   press Analyze. Expect "Analysis unavailable — retry" within 30 s, the earlier result still shown
   as "Previous analysis from …", and the wizard's Next/Publish still working. A `failed` row with
   `failure_reason` is stored. Restore the env and press Retry → result.
6. **Double click** — Press Analyze twice quickly → only one new row.
7. **Demo seed** — The seeded demo request shows a result with a "Demo" badge even with AI disabled.
8. **States & a11y** — Tab through the panel; buttons focusable; the result region announces
   updates; check loading, empty (no photo), consent-missing, success, unavailable states on a
   mobile viewport (375 px).
9. **Logs** — Server logs show one `roof_analysis` line per attempt with outcome and duration only;
   no base64, paths, names or keys.
