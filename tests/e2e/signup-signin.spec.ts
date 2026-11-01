import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("vendor fields appear only when Vendor is selected", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByLabel("Company name")).toHaveCount(0);
  await page.getByRole("radio", { name: "Vendor" }).check();
  await expect(page.getByLabel("Company name")).toBeVisible();
  await expect(page.getByLabel("Service area")).toBeVisible();
  await page.getByRole("radio", { name: "Household" }).check();
  await expect(page.getByLabel("Company name")).toHaveCount(0);
});

test("household sign-up, sign-out and sign-in again", async ({ page }) => {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  const password = "solar-2026!";

  await page.goto("/signup");
  await page.getByRole("radio", { name: "Household" }).check();
  await page.getByLabel("Full name").fill("E2E Household");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/household");
  await expect(page.getByRole("button", { name: /account menu for e2e household/i })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/household$/);

  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/household");
});
