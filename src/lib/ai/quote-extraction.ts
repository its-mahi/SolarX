// Task service for quote extraction (specs/009). The only caller of generateStructured for
// task "quote_extraction". The vendor document is untrusted: it is framed by untrustedText /
// untrustedFile, the model gets no tools, and its output only ever becomes a form pre-fill.
import "server-only";
import { generateStructured } from "./client";
import { instructionText, untrustedFile, untrustedText } from "./untrusted";
import {
  computeMissingFields,
  QUOTE_EXTRACTION_JSON_SCHEMA,
  QuoteExtractionEnvelopeSchema,
  sanitizeQuoteExtraction,
  type QuoteExtractionFields,
  type QuoteFieldPath,
} from "./schemas/quote-extraction";
import { QUOTE_EXTRACTION_PROMPT_VERSION, QUOTE_EXTRACTION_SYSTEM_INSTRUCTION } from "./prompts/quote-extraction.v1";
import type { AiCallMeta, AiFailure } from "./types";
import { MAX_QUOTE_TEXT_CHARS, type QuoteFileType } from "@/lib/validation/quote-extraction";

export type QuoteExtractionInput =
  | { kind: "text"; text: string }
  | { kind: "file"; bytes: Uint8Array; mimeType: QuoteFileType };

export type QuoteExtractionResult =
  | {
      ok: true;
      fields: QuoteExtractionFields;
      discarded_fields: string[];
      missing_fields: QuoteFieldPath[];
      meta: AiCallMeta;
    }
  | { ok: false; failure: AiFailure; meta: AiCallMeta };

export async function extractQuote(input: QuoteExtractionInput): Promise<QuoteExtractionResult> {
  const instruction = instructionText("Extract the quotation fields from the vendor document below.");
  const result = await generateStructured({
    task: "quote_extraction",
    promptVersion: QUOTE_EXTRACTION_PROMPT_VERSION,
    systemInstruction: QUOTE_EXTRACTION_SYSTEM_INSTRUCTION,
    capability: input.kind === "text" ? "text" : input.mimeType === "application/pdf" ? "document" : "vision",
    schema: QuoteExtractionEnvelopeSchema,
    responseJsonSchema: QUOTE_EXTRACTION_JSON_SCHEMA,
    input:
      input.kind === "text"
        ? [instruction, untrustedText("vendor_quote", input.text, { maxChars: MAX_QUOTE_TEXT_CHARS })]
        : [instruction, ...untrustedFile("vendor_quote_document", input.bytes, input.mimeType)],
  });
  if (!result.ok) return { ok: false, failure: result.error, meta: result.meta };
  const { fields, discarded_fields } = sanitizeQuoteExtraction(result.data);
  return { ok: true, fields, discarded_fields, missing_fields: computeMissingFields(fields), meta: result.meta };
}
