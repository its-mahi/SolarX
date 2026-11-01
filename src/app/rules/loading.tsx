import { LoadingState } from "@/components/shared/loading-state";

export default function RulesLoading() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <LoadingState label="Loading rules…" />
    </main>
  );
}
