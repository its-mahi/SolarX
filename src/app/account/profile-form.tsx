"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describedBy, fieldErrorsFromDetails, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import type { Role } from "@/lib/validation/enums";
import { profileUpdateSchema, vendorProfileUpdateSchema } from "@/lib/validation/profile";

type Values = { name: string; phone: string; company_name: string; service_area: string; service_radius_km: string };

export function ProfileForm({ role, initial }: { role: Role; initial: Values }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: Record<string, unknown> = { name: values.name, phone: values.phone.trim() || null };
    if (role === "vendor") {
      body.company_name = values.company_name;
      body.service_area = values.service_area;
      body.service_radius_km = values.service_radius_km.trim() === "" ? undefined : Number(values.service_radius_km);
    }

    const schema = role === "vendor" ? vendorProfileUpdateSchema : profileUpdateSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const next = fieldErrorsFromZod(parsed.error);
      setErrors(next);
      focusFirstInvalid(formRef.current, next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const next = fieldErrorsFromDetails(json?.error?.details);
        setErrors(Object.keys(next).length ? next : { form: json?.error?.message ?? "We couldn't save your changes. Please try again." });
        focusFirstInvalid(formRef.current, next);
        return;
      }
      toast.success("Your changes are saved.");
      router.refresh();
    } catch {
      setErrors({ form: "We couldn't reach SolarX. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Edit your details</h2>
      <TextField label="Full name" name="name" value={values.name} onChange={set("name")} errors={errors} autoComplete="name" />
      <TextField
        label="Mobile number (optional)"
        name="phone"
        type="tel"
        value={values.phone}
        onChange={set("phone")}
        errors={errors}
        autoComplete="tel"
      />
      {role === "vendor" ? (
        <>
          <TextField label="Company name" name="company_name" value={values.company_name} onChange={set("company_name")} errors={errors} />
          <TextField label="Service area" name="service_area" value={values.service_area} onChange={set("service_area")} errors={errors} />
          <TextField
            label="Service radius in km"
            name="service_radius_km"
            type="number"
            inputMode="numeric"
            value={values.service_radius_km}
            onChange={set("service_radius_km")}
            errors={errors}
          />
        </>
      ) : null}
      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-fit px-5" disabled={saving}>
        {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

type TextFieldProps = { label: string; name: string; errors: FieldErrors } & Omit<React.ComponentProps<typeof Input>, "name">;

function TextField({ label, name, errors, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11" {...props} {...describedBy(errors, name)} />
      <FieldError id={`${name}-error`} message={errors[name]} />
    </div>
  );
}
