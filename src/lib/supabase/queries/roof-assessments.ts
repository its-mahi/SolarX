// User-scoped (RLS) query helpers for roof_assessments. Callers pass the request's own client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RoofAssessmentDto, RoofAssessmentStateDto } from "@/lib/validation/roof";

type Client = SupabaseClient<Database>;
export type RoofAssessmentRow = Database["public"]["Tables"]["roof_assessments"]["Row"];
export type RoofAssessmentInsert = Database["public"]["Tables"]["roof_assessments"]["Insert"];

export async function insertRoofAssessment(client: Client, row: RoofAssessmentInsert): Promise<RoofAssessmentRow> {
  const { data, error } = await client.from("roof_assessments").insert(row).select("*").single();
  if (error || !data) throw error ?? new Error("roof assessment insert returned no row");
  return data;
}

export function toRoofAssessmentDto(row: RoofAssessmentRow, currentRoofPhotoPath: string | null): RoofAssessmentDto {
  return {
    id: row.id,
    request_id: row.request_id,
    status: "completed",
    observations: row.observations as RoofAssessmentDto["observations"],
    potential_obstructions: row.potential_obstructions as string[],
    limitations: row.limitations as string[],
    site_survey_required: true,
    model: row.model,
    prompt_version: row.prompt_version,
    is_current_photo: currentRoofPhotoPath !== null && row.roof_photo_path === currentRoofPhotoPath,
    created_at: row.created_at,
  };
}

export async function getRoofAssessmentState(
  client: Client,
  requestId: string,
  request: { roof_photo_path: string | null; ai_consent: boolean; status: string },
): Promise<RoofAssessmentStateDto> {
  const [completed, attempt] = await Promise.all([
    client.from("roof_assessments").select("*").eq("request_id", requestId).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("roof_assessments").select("id, status, created_at").eq("request_id", requestId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (completed.error) throw completed.error;
  if (attempt.error) throw attempt.error;
  return {
    request: {
      has_roof_photo: request.roof_photo_path !== null,
      ai_consent: request.ai_consent,
      analyzable: ["draft", "open", "quoted"].includes(request.status),
    },
    latest_completed: completed.data ? toRoofAssessmentDto(completed.data, request.roof_photo_path) : null,
    latest_attempt: attempt.data
      ? { id: attempt.data.id, status: attempt.data.status as "completed" | "failed", created_at: attempt.data.created_at }
      : null,
  };
}
