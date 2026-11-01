import { QuoteHistory } from "@/components/quotes/quote-history";

export default function VendorQuotesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">My quotes</h1>
      <QuoteHistory />
    </div>
  );
}
