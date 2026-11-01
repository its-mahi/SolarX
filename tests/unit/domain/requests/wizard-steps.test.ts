import { describe, expect, it } from "vitest";
import { firstIncompleteStep, stepForField } from "@/lib/domain/requests/wizard-steps";
import type { PublishReadinessInput } from "@/lib/domain/requests/publish-readiness";

const empty: PublishReadinessInput = {
  latitude: null, longitude: null, address_text: null, locality: null,
  monthly_units: null, budget: null, roof_photo_path: null,
};

describe("firstIncompleteStep", () => {
  it("walks the wizard in order", () => {
    expect(firstIncompleteStep(empty)).toBe("location");
    const loc = { ...empty, latitude: 17, longitude: 78, address_text: "Plot 12, Road 3", locality: "Banjara Hills" };
    expect(firstIncompleteStep(loc)).toBe("photo");
    const photo = { ...loc, roof_photo_path: "u/r/a.jpg" };
    expect(firstIncompleteStep(photo)).toBe("usage");
    expect(firstIncompleteStep({ ...photo, monthly_units: 250, budget: 150000 })).toBe("review");
  });
});

describe("stepForField", () => {
  it("maps fields to steps", () => {
    expect(stepForField("location")).toBe("location");
    expect(stepForField("address_text")).toBe("location");
    expect(stepForField("locality")).toBe("location");
    expect(stepForField("roof_photo")).toBe("photo");
    expect(stepForField("monthly_units")).toBe("usage");
    expect(stepForField("budget")).toBe("usage");
  });
});
