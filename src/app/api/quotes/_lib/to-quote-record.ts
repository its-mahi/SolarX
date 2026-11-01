// Shapes a quotes row for vendors: omits vendor_id and source_document_path (contracts/quotes.md).
import type { Database } from "@/lib/supabase/database.types";
import type { QuoteRecord } from "@/lib/validation/quote";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

export function toQuoteRecord(row: QuoteRow): QuoteRecord {
  return {
    id: row.id,
    request_id: row.request_id,
    price: row.price,
    capacity_kw: Number(row.capacity_kw),
    panel_details: row.panel_details as QuoteRecord["panel_details"],
    inverter_details: row.inverter_details as QuoteRecord["inverter_details"],
    warranty_details: row.warranty_details as QuoteRecord["warranty_details"],
    installation_days: row.installation_days,
    earthing_included: row.earthing_included,
    documentation_included: row.documentation_included,
    other_inclusions: row.other_inclusions as string[],
    exclusions: row.exclusions,
    vendor_notes: row.vendor_notes,
    source: row.source as QuoteRecord["source"],
    status: row.status as QuoteRecord["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
