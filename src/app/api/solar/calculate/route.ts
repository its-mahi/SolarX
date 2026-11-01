// POST /api/solar/calculate — deterministic estimate (contracts/solar-calculate.md).
// Implemented here: inputs preview (what-if), never saved. Modes that read or save a stored
// request (`requestId`) need feature 002's household_requests table and are added with it.
import { requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { activeRuleSet } from "@/config/rules";
import { buildSolarEstimate, FinancialInputError } from "@/lib/domain/financial";
import { calculateRequestSchema, ESTIMATE_DISCLAIMER } from "@/lib/validation/solar";

export const POST = withApiHandler(async (request) => {
  const body = await parseJsonBody(request, calculateRequestSchema);
  await requireRole(request, "household");

  if (body.requestId !== undefined || !body.inputs) {
    throw new ApiError("VALIDATION_FAILED", "Estimates for a saved request are not available yet. Send the inputs instead.");
  }

  try {
    const estimate = buildSolarEstimate(body.inputs, activeRuleSet, { capacityOverrideKw: body.capacityOverrideKw });
    logEvent("solar.estimate_preview", { reason: activeRuleSet.version });
    return ok({ saved: false, estimate: { requestId: null, ...estimate }, disclaimer: ESTIMATE_DISCLAIMER }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof FinancialInputError) {
      throw new ApiError("VALIDATION_FAILED", err.message, [{ path: "capacityOverrideKw", message: err.message }]);
    }
    throw err;
  }
});
