import Link from "next/link";
import { Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { href?: string; className?: string };

export function BrandLogo({ href = "/", className }: Props) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-md font-bold tracking-tight text-primary", className)}>
      <Sun aria-hidden className="size-6 text-solar" strokeWidth={2.25} />
      <span className="text-lg">SURYAMIT</span>
    </Link>
  );
}
