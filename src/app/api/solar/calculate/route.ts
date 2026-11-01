// POST /api/solar/calculate — deterministic estimate (contracts/solar-calculate.md).
// Modes: { requestId } saves (upserts) the request's estimate; { requestId, capacityOverrideKw }
// and { inputs, capacityOverrideKw? } return unsaved previews. No AI is involved.
import { requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { activeRuleSet } from "@/config/rules";
import { buildSolarEstimate, FinancialInputError, type EstimateInputs, type SolarEstimate } from "@/lib/domain/financial";
import { getOwnRequest } from "@/lib/requests/repository";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { calculateRequestSchema, ESTIMATE_DISCLAIMER } from "@/lib/validation/solar";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

function respond(estimate: SolarEstimate, requestId: string | null, saved: boolean, updatedAt?: string) {
  return ok(
    { saved, estimate: { requestId, ...estimate, ...(updatedAt ? { updatedAt } : {}) }, disclaimer: ESTIMATE_DISCLAIMER },
    NO_STORE,
  );
}

export const POST = withApiHandler(async (request) => {
  const body = await parseJsonBody(request, calculateRequestSchema);
  const ctx = await requireRole(request, "household");

  try {
    if (body.inputs) {
      const estimate = buildSolarEstimate(body.inputs, activeRuleSet, { capacityOverrideKw: body.capacityOverrideKw });
      logEvent("solar.estimate_preview", { reason: activeRuleSet.version });
      return respond(estimate, null, false);
    }

    const requestId = body.requestId!;
    const row = await getOwnRequest(ctx.supabase, requestId);
    if (!row) throw new ApiError("NOT_FOUND", "We could not find that request.");
    if (row.monthly_units === null) {
      throw new ApiError("CONFLICT", "Enter monthly consumption to calculate an estimate.");
    }
    const inputs: EstimateInputs = {
      monthlyUnits: row.monthly_units,
      monthlyBill: row.monthly_bill,
      budget: row.budget,
      preferredCapacityKw: row.preferred_capacity_kw === null ? null : Number(row.preferred_capacity_kw),
    };
    const estimate = buildSolarEstimate(inputs, activeRuleSet, { capacityOverrideKw: body.capacityOverrideKw });

    if (body.capacityOverrideKw !== undefined) {
      logEvent("solar.estimate_preview", { requestId, reason: activeRuleSet.version });
      return respond(estimate, requestId, false);
    }

    // Ownership is proven above (RLS-bound read); only now does the server write.
    const { data, error } = await createAdminSupabase()
      .from("solar_estimates")
      .upsert(
        {
          request_id: requestId,
          capacity_kw: estimate.capacityKw,
          installation_cost: estimate.installationCost,
          subsidy_estimate: estimate.subsidyEstimate,
          net_cost: estimate.netCost,
          annual_generation_kwh: estimate.annualGenerationKwh,
          annual_savings_estimate: estimate.annualSavingsEstimate,
          payback_years: estimate.paybackYears,
          assumptions: estimate.assumptions as unknown as NonNullable<Json>,
          rule_version: estimate.ruleVersion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id" },
      )
      .select("updated_at")
      .single();
    if (error) throw error;
    logEvent("solar.estimate_saved", { requestId, reason: activeRuleSet.version });
    return respond(estimate, requestId, true, data.updated_at);
  } catch (err) {
    if (err instanceof FinancialInputError) {
      throw new ApiError("VALIDATION_FAILED", err.message, [{ path: "capacityOverrideKw", message: err.message }]);
    }
    throw err;
  }
});
