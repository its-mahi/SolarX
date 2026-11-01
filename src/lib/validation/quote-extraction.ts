// Request/response schemas and limits for quote extraction (specs/009 contracts/).
import { z } from "zod";
import { uuidSchema } from "./common";
import { quoteSubmissionSchema } from "./quote";

export const MAX_QUOTE_TEXT_CHARS = 20_000;
export const MAX_QUOTE_FILE_BYTES = 5 * 1024 * 1024;
export const QUOTE_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type QuoteFileType = (typeof QUOTE_FILE_TYPES)[number];

export const QUOTE_DOCUMENT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/source\.(jpg|png|pdf|txt)$/;

/** Text part of the multipart request (the file is checked by bytes in the route). */
export const QuoteExtractRequestSchema = z.object({
  request_id: uuidSchema,
  text: z.string().trim().min(1).max(MAX_QUOTE_TEXT_CHARS).optional(),
});

const nullable = <T extends z.ZodType>(t: T) => t.nullable();

export const QuoteExtractionFieldsSchema = z.object({
  vendor_name: nullable(z.string()),
  price_inr: nullable(z.number()),
  capacity_kw: nullable(z.number()),
  panel_details: z.object({ brand: nullable(z.string()), wattage: nullable(z.number()), quantity: nullable(z.number()) }),
  inverter_details: z.object({ brand: nullable(z.string()), type: nullable(z.string()) }),
  warranty_details: z.object({
    panel_product_years: nullable(z.number()),
    performance_years: nullable(z.number()),
    inverter_years: nullable(z.number()),
  }),
  installation_days: nullable(z.number()),
  earthing_included: nullable(z.boolean()),
  documentation_included: nullable(z.boolean()),
});

const SourceDocumentSchema = z.object({
  path: z.string().regex(QUOTE_DOCUMENT_PATH_RE),
  kind: z.enum(["text", "image", "pdf"]),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
});

export const QuoteExtractResponseSchema = z.object({
  data: z.object({
    fields: QuoteExtractionFieldsSchema,
    prefill: z.object({
      price: nullable(z.number()),
      capacity_kw: nullable(z.number()),
      panel_details: z.object({ brand: nullable(z.string()), wattage: nullable(z.number()), quantity: nullable(z.number()) }),
      inverter_details: z.object({ brand: nullable(z.string()), type: nullable(z.string()) }),
      warranty_details: z.object({
        panel_product_years: nullable(z.number()),
        performance_years: nullable(z.number()),
        inverter_years: nullable(z.number()),
      }),
      installation_days: nullable(z.number()),
      earthing_included: nullable(z.boolean()),
      documentation_included: nullable(z.boolean()),
      source: z.literal("ai_extracted"),
      source_document_path: z.string().regex(QUOTE_DOCUMENT_PATH_RE),
    }),
    missing_fields: z.array(z.string()),
    discarded_fields: z.array(z.string()),
    document_vendor_name: nullable(z.string()),
    source_document: SourceDocumentSchema,
    model: z.string().nullable(),
    prompt_version: z.string(),
    notice: z.string(),
  }),
});
export type QuoteExtractResponse = z.infer<typeof QuoteExtractResponseSchema>;
export type QuoteExtractData = QuoteExtractResponse["data"];

export const QuoteSourceDocumentResponseSchema = z.object({
  data: z.object({
    url: z.string().url(),
    expires_at: z.string(),
    kind: z.enum(["text", "image", "pdf"]),
    mime_type: z.string(),
    label: z.string(),
  }),
});
export type QuoteSourceDocumentResponse = z.infer<typeof QuoteSourceDocumentResponseSchema>;

/**
 * POST /api/quotes body: 005's strict fields plus the optional source columns (009).
 * ai_extracted needs a well-formed path; manual must not carry one.
 */
export const quoteSubmissionWithSourceSchema = quoteSubmissionSchema
  .extend({
    source: z.enum(["manual", "ai_extracted"]).optional(),
    source_document_path: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const source = v.source ?? "manual";
    const path = v.source_document_path ?? null;
    if (source === "ai_extracted") {
      if (path === null || !QUOTE_DOCUMENT_PATH_RE.test(path)) {
        ctx.addIssue({ code: "custom", path: ["source_document_path"], message: "A valid source document is required for AI-extracted quotes" });
      }
    } else if (path !== null) {
      ctx.addIssue({ code: "custom", path: ["source_document_path"], message: "Manual quotes cannot reference a source document" });
    }
  });
