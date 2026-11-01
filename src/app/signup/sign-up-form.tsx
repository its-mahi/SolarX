"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { describedBy, fieldErrorsFromDetails, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { signUpSchema } from "@/lib/validation/auth";

type Role = "household" | "vendor";

export function SignUpForm({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<Role>(initialRole);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    const radius = text("service_radius_km").trim();

    const body: Record<string, unknown> = {
      role,
      name: text("name"),
      email: text("email"),
      password: text("password"),
      phone: text("phone").trim() || null,
    };
    if (role === "vendor") {
      body.company_name = text("company_name");
      body.service_area = text("service_area");
      if (radius) body.service_radius_km = Number(radius);
    }

    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      const next = fieldErrorsFromZod(parsed.error);
      setErrors(next);
      focusFirstInvalid(formRef.current, next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const next = fieldErrorsFromDetails(json?.error?.details);
        if (Object.keys(next).length > 0) {
          setErrors(next);
          focusFirstInvalid(formRef.current, next);
        } else {
          setErrors({ form: json?.error?.message ?? "We couldn't create your account right now. Please try again." });
        }
        return;
      }
      toast.success("Your account is ready.");
      router.replace(json.data.redirect_to);
      router.refresh();
    } catch {
      setErrors({ form: "We couldn't reach SolarX. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5 rounded-xl border bg-card p-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">I am a</legend>
        <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="grid grid-cols-2 gap-3">
          {(["household", "vendor"] as const).map((value) => (
            <Label
              key={value}
              htmlFor={`role-${value}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-mint"
            >
              <RadioGroupItem id={`role-${value}`} value={value} />
              {value === "household" ? "Household" : "Vendor"}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <Field label="Full name" name="name" autoComplete="name" errors={errors} />
      <Field label="Email" name="email" type="email" autoComplete="email" errors={errors} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="8 to 72 characters." errors={errors} />
      <Field label="Mobile number (optional)" name="phone" type="tel" autoComplete="tel" hint="Indian mobile, e.g. 98765 43210." errors={errors} />

      {role === "vendor" ? (
        <div className="flex flex-col gap-5 border-t pt-5">
          <Field label="Company name" name="company_name" autoComplete="organization" errors={errors} />
          <Field label="Service area" name="service_area" hint="City and state, e.g. Hyderabad, Telangana." errors={errors} />
          <Field label="Service radius in km (optional)" name="service_radius_km" type="number" inputMode="numeric" hint="1 to 500. Default 25." errors={errors} />
        </div>
      ) : null}

      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11" disabled={submitting}>
        {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  errors: FieldErrors;
  hint?: string;
} & Omit<React.ComponentProps<typeof Input>, "name">;

function Field({ label, name, errors, hint, ...inputProps }: FieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  const a11y = describedBy(errors, name);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        className="h-11"
        {...inputProps}
        aria-invalid={a11y["aria-invalid"]}
        aria-describedby={[a11y["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${name}-error`} message={errors[name]} />
    </div>
  );
}
