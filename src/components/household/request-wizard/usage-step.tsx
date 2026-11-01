"use client";

import { useRef, useState, type FormEvent } from "react";
import { UsageVoiceSlot } from "@/components/household/extension-slots";
import { FieldError } from "@/components/shared/field-error";
import { SlotBoundary } from "@/components/shared/slot-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describedBy, fieldErrorsFromDetails, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { usageFieldsSchema, type UsageFields } from "@/lib/validation/requests";
import { StepActions } from "./step-actions";
import type { StepProps } from "./step-types";
import { patchRequest } from "./use-request-api";

type Key = keyof UsageFields;
const KEYS: Key[] = ["monthly_units", "monthly_bill", "budget", "preferred_capacity_kw"];

const text = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function UsageStep({ request, onContinue, onBack, onConflict }: StepProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<Key, string>>({
    monthly_units: text(request?.monthly_units),
    monthly_bill: text(request?.monthly_bill),
    budget: text(request?.budget),
    preferred_capacity_kw: text(request?.preferred_capacity_kw),
  });
  const [suggested, setSuggested] = useState<Set<Key>>(new Set());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (!request) return null;
  const requestId = request.id;

  const setValue = (key: Key, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSuggested((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  };

  function onSuggest(found: Partial<UsageFields>) {
    const keys = KEYS.filter((k) => found[k] !== undefined && found[k] !== null);
    setValues((v) => ({ ...v, ...Object.fromEntries(keys.map((k) => [k, String(found[k])])) }));
    setSuggested(new Set(keys));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Blank fields are saved as empty so a draft can be completed later; the review step lists what is missing.
    const body: Record<string, number | null> = {};
    const check: Record<string, unknown> = {};
    for (const key of KEYS) {
      const raw = values[key].trim().replace(/,/g, "");
      const num = raw === "" ? null : Number(raw);
      body[key] = raw !== "" && !Number.isFinite(num) ? NaN : num;
      if (num !== null) check[key] = Number.isFinite(num) ? num : "x";
    }
    const parsed = usageFieldsSchema.partial().safeParse(check);
    if (!parsed.success) {
      const next = fieldErrorsFromZod(parsed.error);
      setErrors(next);
      focusFirstInvalid(formRef.current, next);
      return;
    }
    setErrors({});
    setPending(true);
    const result = await patchRequest(requestId, body);
    setPending(false);
    if (result.ok) return onContinue(result.data);
    if (result.status === 409) return onConflict();
    const next = fieldErrorsFromDetails(result.details);
    setErrors(Object.keys(next).length ? next : { form: result.message });
    focusFirstInvalid(formRef.current, next);
  }

  const field = (key: Key, label: string, hint: string, required: boolean) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={key}>
        {label}
        {required ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      <Input
        id={key}
        name={key}
        inputMode={key === "preferred_capacity_kw" ? "decimal" : "numeric"}
        className="h-11"
        value={values[key]}
        onChange={(e) => setValue(key, e.target.value)}
        {...describedBy(errors, key)}
        aria-describedby={[errors[key] ? `${key}-error` : null, `${key}-hint`].filter(Boolean).join(" ")}
      />
      <p id={`${key}-hint`} className="text-xs text-muted-foreground">
        {hint}
        {suggested.has(key) ? <span className="ml-1 font-medium text-foreground">Suggested — please check</span> : null}
      </p>
      <FieldError id={`${key}-error`} message={errors[key]} />
    </div>
  );

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <SlotBoundary name="usage-voice">
        <UsageVoiceSlot onSuggest={onSuggest} disabled={pending} />
      </SlotBoundary>
      {field("monthly_units", "Monthly electricity use (units, kWh)", "Find it on your electricity bill. 1 to 10,000.", true)}
      {field("monthly_bill", "Monthly bill in ₹", "Your usual monthly electricity bill.", false)}
      {field("budget", "Budget in ₹", "What you can spend on the installation. ₹10,000 to ₹50,00,000.", true)}
      {field("preferred_capacity_kw", "Preferred capacity in kW", "Leave blank if you are not sure. 0.5 to 20 kW in steps of 0.1.", false)}
      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <StepActions onBack={onBack} pending={pending} />
    </form>
  );
}
