import { Compass } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <EmptyState
        icon={Compass}
        title="We couldn't find that page"
        description="The link may be out of date, or the page may not be available for your account."
        action={{ label: "Go to the home page", href: "/" }}
      />
    </main>
  );
}
