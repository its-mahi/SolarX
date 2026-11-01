import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function vendorSignIn(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /sunrise energy/i }).click();
  await page.waitForURL("**/vendor");
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();
}

test("vendor discovers a demo request: list, filter, map, privacy-safe detail", async ({ page }) => {
  await vendorSignIn(page);
  const cards = page.locator("main li").filter({ has: page.getByRole("link", { name: /view details/i }) });
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();

  // A capacity filter that matches nothing, then clear.
  await page.getByLabel("Min capacity (kW)").fill("99");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/min_capacity_kw=99/);
  await expect(page.getByRole("heading", { name: /no requests match/i })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(cards.first()).toBeVisible();

  // Invalid filter shows a field error.
  await page.getByLabel("Min budget (₹)").fill("abc");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Budget must be a number")).toBeVisible();
  await page.getByLabel("Min budget (₹)").fill("");

  // Map: marker count equals card count.
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("region", { name: "Map of open requests" })).toBeVisible();
  await expect(page.locator("path.request-marker")).toHaveCount(count);

  // Detail page.
  await page.getByRole("button", { name: "List", exact: true }).click();
  await cards.filter({ hasText: "Demo" }).first().getByRole("link", { name: /view details/i }).click();
  await expect(page.getByText(/Exact address and contact details are shared only if the household accepts/)).toBeVisible();
  await expect(page.getByRole("img", { name: /roof photo/i })).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/sharma/i);
  expect(text).not.toMatch(/\+91/);
});

test.describe("360 px", () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test("dashboard and detail fit and pass contrast/label checks", async ({ page }) => {
    await vendorSignIn(page);
    const link = page.getByRole("link", { name: /view details/i }).first();
    await expect(link).toBeVisible();
    for (const step of ["dashboard", "detail"]) {
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect(scrollWidth, step).toBeLessThanOrEqual(innerWidth);
      const r = await new AxeBuilder({ page }).withRules(["color-contrast", "label"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), step).toEqual([]);
      if (step === "dashboard") {
        await link.click();
        await expect(page.getByText(/Exact address and contact details/)).toBeVisible();
      }
    }
  });
});
