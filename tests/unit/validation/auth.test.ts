import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/validation/auth";

const household = { role: "household", name: "Asha Rao", email: "Asha@Example.com", password: "solar-2026!" };
const vendor = {
  role: "vendor",
  name: "Ravi Kumar",
  email: "ravi@example.com",
  password: "solar-2026!",
  company_name: "Ravi Solar Works",
  service_area: "Warangal, Telangana",
};

const parse = (v: unknown) => signUpSchema.safeParse(v);

describe("signUpSchema", () => {
  it("accepts a household and lower-cases the email", () => {
    const r = parse(household);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("asha@example.com");
  });

  it("enforces name length 1–100", () => {
    expect(parse({ ...household, name: "" }).success).toBe(false);
    expect(parse({ ...household, name: "   " }).success).toBe(false);
    expect(parse({ ...household, name: "x".repeat(100) }).success).toBe(true);
    expect(parse({ ...household, name: "x".repeat(101) }).success).toBe(false);
  });

  it("enforces password length 8–72", () => {
    expect(parse({ ...household, password: "1234567" }).success).toBe(false);
    expect(parse({ ...household, password: "12345678" }).success).toBe(true);
    expect(parse({ ...household, password: "x".repeat(73) }).success).toBe(false);
  });

  it("normalizes Indian phone numbers and rejects invalid ones", () => {
    for (const input of ["9876543210", "+91 98765 43210", "+919876543210"]) {
      const r = parse({ ...household, phone: input });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe("+919876543210");
    }
    expect(parse({ ...household, phone: "12345" }).success).toBe(false);
    expect(parse({ ...household, phone: "5876543210" }).success).toBe(false);
  });

  it("requires vendor company_name 2–120 and service_area 2–200", () => {
    expect(parse(vendor).success).toBe(true);
    expect(parse({ ...vendor, company_name: undefined }).success).toBe(false);
    expect(parse({ ...vendor, company_name: "A" }).success).toBe(false);
    expect(parse({ ...vendor, company_name: "x".repeat(121) }).success).toBe(false);
    expect(parse({ ...vendor, service_area: "x" }).success).toBe(false);
    expect(parse({ ...vendor, service_area: "x".repeat(201) }).success).toBe(false);
  });

  it("defaults service_radius_km to 25 and enforces 1–500", () => {
    const r = parse(vendor);
    expect(r.success && r.data.role === "vendor" && r.data.service_radius_km).toBe(25);
    expect(parse({ ...vendor, service_radius_km: 0 }).success).toBe(false);
    expect(parse({ ...vendor, service_radius_km: 501 }).success).toBe(false);
    expect(parse({ ...vendor, service_radius_km: 40 }).success).toBe(true);
  });

  it("requires latitude and longitude together", () => {
    expect(parse({ ...vendor, latitude: 17.4 }).success).toBe(false);
    expect(parse({ ...vendor, latitude: 17.4, longitude: 78.4 }).success).toBe(true);
  });

  it("rejects vendor fields on a household, other roles and unknown keys", () => {
    expect(parse({ ...household, company_name: "X Co" }).success).toBe(false);
    expect(parse({ ...household, role: "admin" }).success).toBe(false);
    expect(parse({ ...household, is_demo: true }).success).toBe(false);
  });
});
