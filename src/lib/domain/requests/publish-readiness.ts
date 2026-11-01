// Publish readiness (data-model.md). Pure; mirrors household_requests_publish_complete_chk.
export const PUBLISH_REQUIRED_FIELDS = [
  "location",
  "address_text",
  "locality",
  "monthly_units",
  "budget",
  "roof_photo",
] as const;

export type PublishField = (typeof PUBLISH_REQUIRED_FIELDS)[number];

export type PublishReadinessInput = {
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  locality: string | null;
  monthly_units: number | null;
  budget: number | null;
  roof_photo_path: string | null;
};

const present = (value: unknown) => value !== null && value !== undefined && value !== "";

export function getMissingPublishFields(request: PublishReadinessInput): PublishField[] {
  const filled: Record<PublishField, boolean> = {
    location: present(request.latitude) && present(request.longitude),
    address_text: present(request.address_text),
    locality: present(request.locality),
    monthly_units: present(request.monthly_units),
    budget: present(request.budget),
    roof_photo: present(request.roof_photo_path),
  };
  return PUBLISH_REQUIRED_FIELDS.filter((field) => !filled[field]);
}

export function isReadyToPublish(request: PublishReadinessInput): boolean {
  return getMissingPublishFields(request).length === 0;
}
