import { describe, expect, it } from "vitest";
import { homePathForRole, safeNextPath } from "@/lib/auth/redirects";

describe("homePathForRole", () => {
  it("maps roles to their home", () => {
    expect(homePathForRole("household")).toBe("/household");
    expect(homePathForRole("vendor")).toBe("/vendor");
  });
});

describe("safeNextPath", () => {
  it("accepts own-role paths and /account", () => {
    expect(safeNextPath("/household/requests/new", "household")).toBe("/household/requests/new");
    expect(safeNextPath("/household", "household")).toBe("/household");
    expect(safeNextPath("/vendor/requests/abc?x=1", "vendor")).toBe("/vendor/requests/abc?x=1");
    expect(safeNextPath("/account", "household")).toBe("/account");
    expect(safeNextPath("/account", "vendor")).toBe("/account");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil",
    "javascript:alert(1)",
    "/vendor",
    "/householdx",
    "",
    undefined,
    null,
  ])("rejects %s for a household and falls back to /household", (next) => {
    expect(safeNextPath(next as string | undefined, "household")).toBe("/household");
  });

  it("rejects the other role's area for a vendor", () => {
    expect(safeNextPath("/household", "vendor")).toBe("/vendor");
  });
});
