import { describe, expect, it } from "vitest";
import {
  myQuotesQuerySchema,
  quoteFieldsSchema,
  quoteIdParamSchema,
  quoteSubmissionSchema,
  withdrawBodySchema,
} from "@/lib/validation/quote";
import { boundaryQuotes, completeQuote, injectionNotes, invalidQuotes, minimalQuote } from "../../fixtures/quote-inputs";

describe("quoteSubmissionSchema", () => {
  it("accepts the complete payload unchanged", () => {
    expect(quoteSubmissionSchema.parse(completeQuote)).toEqual(completeQuote);
  });

  it("accepts the minimal payload and fills nulls", () => {
    const out = quoteSubmissionSchema.parse(minimalQuote);
    expect(out.earthing_included).toBeNull();
    expect(out.panel_details.brand).toBeNull();
    expect(out.panel_details.certifications).toEqual([]);
    expect(out.warranty_details.performance_years).toBeNull();
    expect(out.exclusions).toBeNull();
    expect(out.vendor_notes).toBeNull();
  });

  it.each(Object.entries(boundaryQuotes))("accepts boundary %s", (_n, payload) => {
    expect(quoteSubmissionSchema.safeParse(payload).success).toBe(true);
  });

  it.each(Object.entries(invalidQuotes))("rejects %s", (_n, { payload, path }) => {
    const res = quoteSubmissionSchema.safeParse(payload);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join(".") === path)).toBe(true);
    }
  });

  it("turns empty or blank exclusions and notes into null", () => {
    const out = quoteSubmissionSchema.parse({ ...completeQuote, exclusions: "", vendor_notes: "   " });
    expect(out.exclusions).toBeNull();
    expect(out.vendor_notes).toBeNull();
  });

  it("stores injected-instruction text verbatim (trimmed only)", () => {
    expect(quoteSubmissionSchema.parse({ ...completeQuote, vendor_notes: injectionNotes }).vendor_notes).toBe(injectionNotes);
  });

  it("keeps product and performance warranty separate", () => {
    const out = quoteSubmissionSchema.parse(completeQuote);
    expect(out.warranty_details.panel_product_years).toBe(12);
    expect(out.warranty_details.performance_years).toBe(25);
  });

  it("rejects an unknown inverter type", () => {
    const bad = { ...completeQuote, inverter_details: { type: "micro" } };
    expect(quoteSubmissionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("quoteFieldsSchema", () => {
  it("partial() accepts an empty object (009 pre-fill)", () => {
    expect(quoteFieldsSchema.partial().safeParse({}).success).toBe(true);
  });

  it("does not accept request_id", () => {
    const fields = Object.fromEntries(Object.entries(completeQuote).filter(([k]) => k !== "request_id"));
    expect(quoteFieldsSchema.safeParse(fields).success).toBe(true);
    expect(quoteFieldsSchema.safeParse(completeQuote).success).toBe(false);
  });
});

describe("query and param schemas", () => {
  it("validates my-quotes filters", () => {
    expect(myQuotesQuerySchema.safeParse({}).success).toBe(true);
    expect(myQuotesQuerySchema.safeParse({ status: "withdrawn" }).success).toBe(true);
    expect(myQuotesQuerySchema.safeParse({ status: "bogus" }).success).toBe(false);
    expect(myQuotesQuerySchema.safeParse({ request_id: "nope" }).success).toBe(false);
  });

  it("validates the id param and withdraw body", () => {
    expect(quoteIdParamSchema.safeParse({ id: completeQuote.request_id }).success).toBe(true);
    expect(quoteIdParamSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(withdrawBodySchema.safeParse({}).success).toBe(true);
    expect(withdrawBodySchema.safeParse({ status: "accepted" }).success).toBe(false);
  });
});
