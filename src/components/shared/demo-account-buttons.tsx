"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Store, Home } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNT_OPTIONS, type DemoAccountKey } from "@/lib/auth/demo-account-options";
import { safeNextPath } from "@/lib/auth/redirects";
import type { Role } from "@/lib/validation/enums";

type Props = { next?: string };

export function DemoAccountButtons({ next }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<DemoAccountKey | null>(null);

  async function signIn(key: DemoAccountKey) {
    setPending(key);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: key }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data) {
        throw new Error(body?.error?.message ?? "Demo account is unavailable right now. Please try again or sign in.");
      }
      const role = body.data.profile.role as Role;
      router.replace(next ? safeNextPath(next, role) : body.data.redirect_to);
      router.refresh();
    } catch (err) {
      setPending(null);
      toast.error(err instanceof Error ? err.message : "Demo account is unavailable right now.", {
        action: { label: "Retry", onClick: () => void signIn(key) },
      });
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DEMO_ACCOUNT_OPTIONS.map((option) => {
        const Icon = option.role === "household" ? Home : Store;
        const isPending = pending === option.key;
        return (
          <Button
            key={option.key}
            type="button"
            variant={option.role === "household" ? "default" : "outline"}
            size="lg"
            className="h-auto min-h-11 justify-start whitespace-normal py-2.5 text-left"
            disabled={pending !== null}
            aria-busy={isPending}
            onClick={() => void signIn(option.key)}
          >
            {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
