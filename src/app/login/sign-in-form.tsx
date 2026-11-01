"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/auth/redirects";
import { describedBy, fieldErrorsFromZod, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { signInSchema } from "@/lib/validation/auth";
import type { Role } from "@/lib/validation/enums";

const GENERIC_FAILURE = "Email or password is incorrect.";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    if (!parsed.success) {
      const nextErrors = fieldErrorsFromZod(parsed.error);
      setErrors(nextErrors);
      focusFirstInvalid(formRef.current, nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        setErrors({ form: GENERIC_FAILURE });
        return;
      }
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        await supabase.auth.signOut({ scope: "local" });
        setErrors({ form: "Your account could not be loaded. Please try again." });
        return;
      }
      router.replace(safeNextPath(next, json.data.profile.role as Role));
      router.refresh();
    } catch {
      setErrors({ form: "We couldn't reach SURYAMIT. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" className="h-11" {...describedBy(errors, "email")} />
        <FieldError id="email-error" message={errors.email} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" className="h-11" {...describedBy(errors, "password")} />
        <FieldError id="password-error" message={errors.password} />
      </div>
      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={submitting}>
        {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
