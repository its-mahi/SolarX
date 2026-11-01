import { expect, test } from "@playwright/test";

test("landing page explains the product and offers demo accounts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand your roof");
  for (const step of ["Publish your request", "Receive vendor quotes", "Compare clearly", "Accept with confidence"]) {
    await expect(page.getByText(step)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /for households/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /for vendors/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /try as demo household/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sunrise energy/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /greenvolt solar/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /solartech solutions/i })).toBeVisible();
  await expect(page.getByText("Fictional demo data.")).toBeVisible();
});

test("demo household → household area, sign out, demo vendor → vendor area", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /try as demo household/i }).click();
  await page.waitForURL("**/household");
  await expect(page.getByRole("button", { name: /account menu for sharma residence/i })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goBack();
  await expect(page).not.toHaveURL(/\/household$/);

  await page.goto("/");
  await page.getByRole("button", { name: /greenvolt solar/i }).click();
  await page.waitForURL("**/vendor");
  await expect(page.getByRole("button", { name: /account menu for greenvolt solar/i })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
});
