import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = { label: string; href?: string; onClick?: () => void };
type Props = { icon?: LucideIcon; title: string; description?: string; action?: Action; className?: string };

export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-10 text-center", className)}>
      {Icon ? <Icon aria-hidden className="size-8 text-solar" /> : null}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        action.href ? (
          <Button asChild size="lg">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="lg" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
