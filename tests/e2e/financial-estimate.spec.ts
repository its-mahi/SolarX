// Plan §18: "Assumptions and rule version are visible". The estimate-card part of this check is
// added with feature 002's request pages; the public rules page is covered here.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("anonymous visitors see every rule, its sources and the CFA examples", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.getByRole("heading", { level: 1, name: "Rules & sources" })).toBeVisible();
  await expect(page.getByText("pm-surya-ghar.v1").first()).toBeVisible();
  await expect(page.getByText(/Illustrative baseline — verify before demo/)).toBeVisible();

  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  const rulesView = isMobile ? page.getByRole("list").filter({ hasText: "Maximum central financial assistance" }) : page.getByRole("table", { name: /Rules used for every estimate/ });
  await expect(rulesView).toContainText("Maximum central financial assistance");
  await expect(rulesView).toContainText("Pending verification");

  const cfa = page.getByRole("table", { name: /central subsidy by system size/i });
  for (const amount of ["₹30,000", "₹45,000", "₹60,000", "₹69,000"]) await expect(cfa).toContainText(amount);
  await expect(cfa.getByRole("row", { name: /^3 kW/ })).toContainText("₹78,000");
  await expect(cfa.getByRole("row", { name: /^5 kW/ })).toContainText("₹78,000");

  for (const name of ["PM Surya Ghar National Portal", "Ministry of New and Renewable Energy", "MyScheme"]) {
    await expect(page.getByRole("link", { name })).toHaveAttribute("href", /^https:\/\//);
  }
  await expect(page.getByRole("main").getByText(/Subsidy eligibility, approval and payment/)).toBeVisible();
});

test("rules page fits 360 px and passes contrast checks", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/rules");
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  const results = await new AxeBuilder({ page }).withRules(["color-contrast", "label", "scope-attr-valid"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
