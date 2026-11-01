import { describe, expect, it } from "vitest";
import { getMissingPublishFields, isReadyToPublish, type PublishReadinessInput } from "@/lib/domain/requests/publish-readiness";

const complete: PublishReadinessInput = {
  latitude: 17.41,
  longitude: 78.44,
  address_text: "Plot 12, Banjara Hills",
  locality: "Banjara Hills",
  monthly_units: 250,
  budget: 150000,
  roof_photo_path: "u/r/a.jpg",
};
const empty: PublishReadinessInput = {
  latitude: null,
  longitude: null,
  address_text: null,
  locality: null,
  monthly_units: null,
  budget: null,
  roof_photo_path: null,
};

describe("getMissingPublishFields", () => {
  it("returns [] for a complete request", () => {
    expect(getMissingPublishFields(complete)).toEqual([]);
    expect(isReadyToPublish(complete)).toBe(true);
  });

  it("reports location when either coordinate is missing", () => {
    expect(getMissingPublishFields({ ...complete, latitude: null })).toEqual(["location"]);
    expect(getMissingPublishFields({ ...complete, longitude: null })).toEqual(["location"]);
  });

  it("reports each other missing field", () => {
    expect(getMissingPublishFields({ ...complete, address_text: null })).toEqual(["address_text"]);
    expect(getMissingPublishFields({ ...complete, locality: null })).toEqual(["locality"]);
    expect(getMissingPublishFields({ ...complete, monthly_units: null })).toEqual(["monthly_units"]);
    expect(getMissingPublishFields({ ...complete, budget: null })).toEqual(["budget"]);
    expect(getMissingPublishFields({ ...complete, roof_photo_path: null })).toEqual(["roof_photo"]);
  });

  it("reports an empty draft in order", () => {
    expect(getMissingPublishFields(empty)).toEqual([
      "location", "address_text", "locality", "monthly_units", "budget", "roof_photo",
    ]);
    expect(isReadyToPublish(empty)).toBe(false);
  });

  it("never reports optional fields", () => {
    const withOptionalNull = { ...complete, monthly_bill: null, preferred_capacity_kw: null };
    expect(getMissingPublishFields(withOptionalNull)).toEqual([]);
  });
});
