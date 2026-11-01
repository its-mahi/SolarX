// Maps a household_requests row to the owner-facing DTO (contracts/requests-api.md).
// roof_photo_path is never exposed.
import { nextActionFor } from "@/lib/domain/requests/next-action";
import { getMissingPublishFields } from "@/lib/domain/requests/publish-readiness";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import type { RequestStatus } from "@/lib/validation/enums";

export type RequestRowLike = {
  id: string;
  status: string;
  address_text: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  monthly_units: number | null;
  monthly_bill: number | null;
  budget: number | null;
  preferred_capacity_kw: number | null;
  ai_consent: boolean;
  roof_photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export function toHouseholdRequestDto(
  row: RequestRowLike,
  options: { signedUrl?: string | null; signedUrlExpiresAt?: string | null } = {},
): HouseholdRequestDto {
  const status = row.status as RequestStatus;
  return {
    id: row.id,
    status,
    address_text: row.address_text,
    locality: row.locality,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    monthly_units: row.monthly_units,
    monthly_bill: row.monthly_bill,
    budget: row.budget,
    preferred_capacity_kw: row.preferred_capacity_kw === null ? null : Number(row.preferred_capacity_kw),
    ai_consent: row.ai_consent,
    has_roof_photo: row.roof_photo_path !== null,
    roof_photo_url: options.signedUrl ?? null,
    roof_photo_url_expires_at: options.signedUrl ? (options.signedUrlExpiresAt ?? null) : null,
    missing_publish_fields: getMissingPublishFields(row),
    next_action: nextActionFor({ ...row, status }),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
