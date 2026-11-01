# Contract: Voice panel ↔ 002 wizard (`UsageVoiceSlot`)

**Provider of the slot**: 002 — `UsageVoiceSlot` in `src/components/household/extension-slots.tsx`,
prop types in `src/components/household/extension-slot-types.ts`, rendered by 002's
`usage-step.tsx` beside the consumption fields inside `SlotBoundary` (see
`specs/002-household-solar-request/plan.md`, "Extension points").
**Consumer**: 010 `VoiceEntryPanel` (`src/components/household/voice/voice-entry-panel.tsx`).

010 changes only the **body** of `UsageVoiceSlot` (002's rule: slot owners never change host
components or prop types).

## Slot props provided by 002

| Prop | Type | 010 use |
|---|---|---|
| `onSuggest` | `(values: Partial<UsageFields>) => void` (`UsageFields` from `src/lib/validation/requests.ts`) | Called by "Use these values". 002 pre-fills the controlled form and highlights the fields "Suggested — please check"; nothing is saved until the household presses Continue (002 FR-010; 010 FR-016) |
| `disabled` | `boolean` | Hide the microphone and interpret actions when the step is not editable |

`UsageFields` keys are exactly the overview §7 columns `monthly_units`, `monthly_bill`, `budget`,
`preferred_capacity_kw`.

## Slot body (010)

```text
UsageVoiceSlot({ onSuggest, disabled }) → <VoiceEntryPanel onSuggest={onSuggest} disabled={disabled} />
```

## What 010 guarantees to 002

- Calls `onSuggest` only after the user selects "Use these values".
- Passes only keys whose review value is non-empty and valid for that key under 002's
  `usageFieldsSchema` (002 plan: "the schema 010 must validate parsed voice output against");
  never passes `null`/`undefined` to clear a field (FR-017).
- Never calls `PATCH /api/requests/:id`, `POST /api/requests/:id/publish` or any other write
  endpoint; never navigates the wizard.
- Renders nothing that blocks or hides the manual inputs, in every panel state; if the panel
  throws, 002's `SlotBoundary` renders nothing and the manual fields still work.
- Has no effect on server-side rendering (speech detection runs after mount).

## Props of `VoiceEntryPanel`

| Prop | Type | Notes |
|---|---|---|
| `onSuggest` | as above | required |
| `disabled` | boolean | optional, default false |
