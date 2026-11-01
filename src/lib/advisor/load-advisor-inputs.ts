// Loads the stored, already-computed results the advisor reads (specs/011 data-model §1).
// Read-only, RLS-bound caller client. Selects no excluded column: no address/coordinates,
// no vendor free text (notes, inclusions, exclusions, panel/inverter text), no 006 explanation text.
//
// T001 notes (exports confirmed): getRoofAssessmentState from src/lib/supabase/queries/roof-assessments.ts,
// 006 review shape = score_breakdown.{parts,comparison} + missing_fields + flags + normalized_fields.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getRoofAssessmentState } from "@/lib/supabase/queries/roof-assessments";
import type { RequestRow } from "@/lib/requests/repository";
import type {
  AdvisorEstimateInput,
  AdvisorInputs,
  AdvisorQuoteInput,
  AdvisorReviewInput,
  AdvisorRoofInput,
} from "@/lib/domain/advisor/types";

type Client = SupabaseClient<Database>;
type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const numOrNull = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const numOr = (v: unknown, d: number): number => numOrNull(v) ?? d;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function parseReview(row: { total_score: unknown; scoring_version: string; missing_fields: unknown; flags: unknown; score_breakdown: unknown; normalized_fields: unknown }): AdvisorReviewInput {
  const sb = rec(row.score_breakdown);
  const parts = rec(sb.parts);
  const part = (k: string) => rec(parts[k]);
  const cmp = sb.comparison && typeof sb.comparison === "object" ? rec(sb.comparison) : null;
  const nf = rec(row.normalized_fields);
  const pe = rec(nf.platformEstimates);
  const warrantyItems = Array.isArray(part("warranty").items) ? (part("warranty").items as unknown[]) : [];
  return {
    totalScore: numOr(row.total_score, 0),
    scoringVersion: row.scoring_version,
    missingFields: strings(row.missing_fields),
    flags: (Array.isArray(row.flags) ? row.flags : [])
      .map((f) => rec(f))
      .filter((f) => typeof f.code === "string")
      .map((f) => ({ code: f.code as string, severity: typeof f.severity === "string" ? f.severity : "info" })),
    parts: {
      price: { points: numOr(part("price").points, 0), max: numOr(part("price").max, 30), notCompared: part("price").notCompared === true },
      technical: { points: numOr(part("technical").points, 0), max: numOr(part("technical").max, 25) },
      warranty: {
        points: numOr(part("warranty").points, 0),
        max: numOr(part("warranty").max, 20),
        items: warrantyItems
          .map((i) => rec(i))
          .filter((i) => typeof i.key === "string")
          .map((i) => ({ key: i.key as string, years: numOrNull(i.years) })),
      },
      completeness: {
        points: numOr(part("completeness").points, 0),
        max: numOr(part("completeness").max, 15),
        stated: numOrNull(part("completeness").stated),
        total: numOrNull(part("completeness").total),
      },
      timeline: { points: numOr(part("timeline").points, 0), max: numOr(part("timeline").max, 10) },
    },
    comparison: cmp
      ? {
          rank: numOrNull(cmp.rank),
          comparedCount: numOrNull(cmp.comparedCount),
          tied: cmp.tied === true,
          comparedQuoteIds: strings(cmp.comparedQuoteIds),
        }
      : null,
    pricePerKw: numOrNull(nf.pricePerKw),
    subsidyEstimate: numOrNull(pe.subsidyEstimate),
    netCostEstimate: numOrNull(pe.netCostEstimate),
  };
}

export async function loadAdvisorInputs(supabase: Client, request: RequestRow): Promise<AdvisorInputs> {
  const requestId = request.id;
  const [roofState, estimateRes, quotesRes] = await Promise.all([
    getRoofAssessmentState(supabase, requestId, {
      roof_photo_path: request.roof_photo_path,
      ai_consent: request.ai_consent,
      status: request.status,
    }),
    supabase
      .from("solar_estimates")
      .select("capacity_kw, installation_cost, subsidy_estimate, net_cost, annual_generation_kwh, annual_savings_estimate, payback_years, rule_version, assumptions")
      .eq("request_id", requestId)
      .maybeSingle(),
    supabase
      .from("quotes")
      .select("id, vendor_id, status, price, capacity_kw, installation_days, earthing_included, documentation_included, created_at")
      .eq("request_id", requestId)
      .in("status", ["submitted", "accepted"]),
  ]);
  if (estimateRes.error) throw estimateRes.error;
  if (quotesRes.error) throw quotesRes.error;

  // Roof
  const completed = roofState.latest_completed;
  let roof: AdvisorRoofInput;
  if (completed) {
    roof = {
      state: "completed",
      isCurrentPhoto: completed.is_current_photo,
      observations: completed.observations.map((o) => ({
        object: o.object,
        description: o.description,
        potentialImpact: o.potential_impact,
        confidence: o.confidence,
      })),
      obstructions: completed.potential_obstructions,
      limitations: completed.limitations,
      siteSurveyRequired: true,
    };
  } else {
    const state = roofState.latest_attempt?.status === "failed" ? "failed" : !request.ai_consent ? "no_consent" : "none";
    roof = { state, isCurrentPhoto: false, observations: [], obstructions: [], limitations: [], siteSurveyRequired: true };
  }

  // Estimate
  let estimate: AdvisorEstimateInput | null = null;
  if (estimateRes.data) {
    const e = estimateRes.data;
    const a = rec(e.assumptions);
    estimate = {
      capacityKw: Number(e.capacity_kw),
      installationCost: e.installation_cost,
      subsidyEstimate: e.subsidy_estimate,
      netCost: e.net_cost,
      annualGenerationKwh: e.annual_generation_kwh,
      annualSavingsEstimate: e.annual_savings_estimate,
      paybackYears: e.payback_years === null ? null : Number(e.payback_years),
      ruleVersion: e.rule_version,
      tariffPerKwh: numOrNull(a.tariffPerKwh),
      generationKwhPerKwYear: numOrNull(a.generationKwhPerKwYear),
    };
  }

  // Quotes + reviews + vendor display names (names are for the page only)
  const quoteRows = quotesRes.data ?? [];
  let quotes: AdvisorQuoteInput[] = [];
  if (quoteRows.length > 0) {
    const [reviewsRes, vendorsRes] = await Promise.all([
      supabase
        .from("quote_reviews")
        .select("quote_id, total_score, scoring_version, missing_fields, flags, score_breakdown, normalized_fields")
        .in("quote_id", quoteRows.map((q) => q.id)),
      supabase
        .from("vendors")
        .select("id, company_name, verification_status")
        .in("id", [...new Set(quoteRows.map((q) => q.vendor_id))]),
    ]);
    if (reviewsRes.error) throw reviewsRes.error;
    const reviews = new Map((reviewsRes.data ?? []).map((r) => [r.quote_id, parseReview(r)]));
    const vendors = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
    quotes = quoteRows.map((q) => {
      const vendor = vendors.get(q.vendor_id);
      return {
        id: q.id,
        createdAt: q.created_at,
        status: q.status as "submitted" | "accepted",
        price: q.price,
        capacityKw: Number(q.capacity_kw),
        installationDays: q.installation_days,
        earthingIncluded: q.earthing_included,
        documentationIncluded: q.documentation_included,
        vendorDisplayName: vendor?.company_name ?? "Vendor",
        isDemo: vendor?.verification_status === "demo",
        review: reviews.get(q.id) ?? null,
      };
    });
  }

  return {
    request: {
      status: request.status,
      monthlyUnits: numOrNull(request.monthly_units),
      monthlyBill: numOrNull(request.monthly_bill),
      budget: numOrNull(request.budget),
      preferredCapacityKw: numOrNull(request.preferred_capacity_kw),
    },
    roof,
    estimate,
    quotes,
  };
}
