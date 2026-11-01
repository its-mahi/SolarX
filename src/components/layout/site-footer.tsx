import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>SURYAMIT shows estimates only. It is not a government service and does not guarantee subsidy.</p>
        <Link href="/rules" className="font-medium text-primary underline-offset-4 hover:underline">
          Rules &amp; sources
        </Link>
      </div>
    </footer>
  );
}
