# Contract: `RoofAnalysisPanel` UI component and 002 extension point

**Owner**: 008 · **File**: `src/components/household/roof-analysis-panel.tsx` (client component)
**Host**: feature 002's `RoofAnalysisSlot` (wizard photo step, wizard review step, request summary).

## Props

```ts
interface RoofAnalysisPanelProps {
  requestId: string;          // household_requests.id (draft or later)
  hasRoofPhoto: boolean;      // from 002's RoofAnalysisSlot props
  aiConsent: boolean;         // from 002's RoofAnalysisSlot props
  status: RequestStatus;      // from 002's RoofAnalysisSlot props
  variant: 'photo-step' | 'review' | 'detail'; // photo-step/review = compact, never blocks Continue/Publish; detail = full
}
```

**Integration (aligned with 002 `contracts/ui-extension-slots.md`, validation-report fix V-03)**:
008 fills only the body of `RoofAnalysisSlot` in `src/components/household/extension-slots.tsx`
and renders `<RoofAnalysisPanel {...props} key={`${props.hasRoofPhoto}-${props.aiConsent}`} />`.
008 does not edit 002's pages or prop types. 002 already places the slot on the wizard photo step
(`photo-step`), the review step (`review`) and the request summary (`detail`). Because the slot
has no callback prop, the consent-missing state shows text that points to the consent control:
"Turn on 'Allow AI analysis of my roof photo' in the photo step" (wizard) or "Edit consent on this
request" (detail). It does not use a callback.

## Data flow

- On mount: `GET /api/requests/:id/roof-assessment`.
- "Analyze roof photo" / "Analyze again" / "Retry": `POST /api/roof/analyze { request_id }`, then
  re-fetch the GET.
- The panel never calls Supabase or the AI provider directly.

## States (FR-024)

| State | Condition | Shows |
|---|---|---|
| Loading (initial) | GET in flight | skeleton |
| Empty — no photo | `has_roof_photo = false` | "Upload a roof photo to get AI observations." |
| Consent missing | `ai_consent = false` | What consent means ("Your photo is sent to an external AI service only if you agree"), guidance text pointing to 002's consent control (see Integration); **no Analyze button** |
| Not analyzable | `analyzable = false` and no result | "Analysis is not available for accepted or closed requests." |
| Ready | consent, photo, no attempt | "Analyze roof photo" primary button + one-line description |
| Analyzing | POST in flight | spinner, "Analyzing your photo… this can take up to 30 seconds", button disabled |
| Result | `latest_completed` present | heading "AI roof observations", label "AI observations — not measurements"; observations list (object, description, potential impact, `AiConfidenceLabel`); potential obstructions as chips; empty variant "No obvious obstructions were visible in this photo"; limitations list (always ≥ 3); site-survey reminder callout (always); footer "Analysed {date} · {model} · {prompt_version}"; "Demo" badge if `model = 'demo-seed'`; "Analyze again" |
| Stale photo | `is_current_photo = false` | notice "This analysis describes a previous photo" + "Analyze current photo" |
| Unavailable | POST returned 503 or `latest_attempt.status = 'failed'` | "Analysis unavailable — retry" + Retry button + "You can continue with your request." ; earlier result (if any) shown below, labelled "Previous analysis from {date}" |
| Error (other) | 4xx/500 | message from the envelope; Retry where sensible |

## Copy rules

- Never "suitable", "guaranteed", "safe", "exact", or a percentage.
- Confidence: `AiConfidenceLabel` (`src/components/household/ai-confidence-label.tsx`) renders
  "Low confidence" / "Medium confidence" / "High confidence"; the panel shows once: "AI
  confidence is an indication, not a guarantee."
- Site-survey reminder: "A vendor site survey is still required to confirm roof space, shading and
  structure."
- All text from the AI is rendered as plain text (React text nodes), never as HTML or Markdown.

## Accessibility

Buttons are keyboard operable; the analyzing and result regions use `aria-live="polite"`; confidence
is conveyed in text, not colour alone; WCAG AA contrast with the project palette.
