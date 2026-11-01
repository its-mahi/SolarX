import { describe, expect, it } from "vitest";
import { nextActionFor } from "@/lib/domain/requests/next-action";

const base = {
  latitude: null, longitude: null, address_text: null, locality: null,
  monthly_units: null, budget: null, roof_photo_path: null,
};

describe("nextActionFor", () => {
  it("maps each status", () => {
    expect(nextActionFor({ ...base, status: "draft" })).toEqual({ kind: "continue", label: "Continue request", step: "location" });
    expect(nextActionFor({ ...base, status: "open" })).toEqual({ kind: "wait", label: "Waiting for vendor quotes" });
    expect(nextActionFor({ ...base, status: "quoted" })).toEqual({ kind: "compare", label: "Compare quotes" });
    expect(nextActionFor({ ...base, status: "accepted" })).toEqual({ kind: "next_steps", label: "View next steps" });
    expect(nextActionFor({ ...base, status: "closed" })).toEqual({ kind: "view", label: "View request" });
  });
});
