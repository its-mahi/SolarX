import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function RequestNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Request not found"
      description="This request does not exist, or it belongs to another account."
      action={{ label: "Back to your dashboard", href: "/household" }}
    />
  );
}
