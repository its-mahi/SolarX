// Small helpers shared by client forms: map Zod issues / API details to per-field messages.
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export function fieldErrorsFromDetails(details: { path: string; message: string }[] | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const d of details ?? []) out[d.path || "form"] ??= d.message;
  return out;
}

/** Moves focus to the first invalid field, in DOM order (FR-030). */
export function focusFirstInvalid(form: HTMLFormElement | null, errors: FieldErrors): void {
  if (!form) return;
  const names = new Set(Object.keys(errors));
  const field = Array.from(form.elements).find(
    (el): el is HTMLElement => el instanceof HTMLElement && "name" in el && names.has((el as HTMLInputElement).name),
  );
  field?.focus();
}

/** Props that link an input to its FieldError for screen readers. */
export function describedBy(errors: FieldErrors, name: string) {
  return errors[name]
    ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
    : { "aria-invalid": undefined, "aria-describedby": undefined };
}
