import { describe, expect, it } from "vitest";
import { profileUpdateSchema, vendorProfileUpdateSchema } from "@/lib/validation/profile";

describe("profileUpdateSchema", () => {
  it("accepts name and phone updates, and null to clear phone", () => {
    expect(profileUpdateSchema.safeParse({ name: "Asha" }).success).toBe(true);
    const r = profileUpdateSchema.safeParse({ phone: "98765 43210" });
    expect(r.success && r.data.phone).toBe("+919876543210");
    expect(profileUpdateSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("enforces name 1–100", () => {
    expect(profileUpdateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });

  it("requires at least one field", () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
  });

  it.each(["role", "is_demo", "email", "company_name"])("rejects unknown key %s", (key) => {
    expect(profileUpdateSchema.safeParse({ name: "A", [key]: "x" }).success).toBe(false);
  });
});

describe("vendorProfileUpdateSchema", () => {
  it("accepts business field updates", () => {
    expect(vendorProfileUpdateSchema.safeParse({ service_radius_km: 35, company_name: "SunRise Energy" }).success).toBe(true);
  });

  it("enforces ranges", () => {
    expect(vendorProfileUpdateSchema.safeParse({ company_name: "A" }).success).toBe(false);
    expect(vendorProfileUpdateSchema.safeParse({ service_area: "x".repeat(201) }).success).toBe(false);
    expect(vendorProfileUpdateSchema.safeParse({ service_radius_km: 0 }).success).toBe(false);
    expect(vendorProfileUpdateSchema.safeParse({ service_radius_km: 900 }).success).toBe(false);
  });

  it("requires latitude and longitude together", () => {
    expect(vendorProfileUpdateSchema.safeParse({ latitude: 17.4 }).success).toBe(false);
    expect(vendorProfileUpdateSchema.safeParse({ latitude: 17.4, longitude: 78.4 }).success).toBe(true);
    expect(vendorProfileUpdateSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true);
  });

  it("rejects verification_status and other protected keys", () => {
    for (const key of ["verification_status", "user_id", "role", "is_demo"]) {
      expect(vendorProfileUpdateSchema.safeParse({ name: "V", [key]: "x" }).success).toBe(false);
    }
  });
});
