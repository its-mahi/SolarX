// Plan §18: "Assumptions and rule version are visible": the estimate card on the demo request's
// page (needs 002's request page) and the public rules page.
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

const DEMO_REQUEST_ID = "d0000000-0000-4000-8000-000000000201";

test("demo household sees the estimate with assumptions, rule version, disclaimer and rules link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /try as demo household/i }).click();
  await page.waitForURL("**/household");
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();

  const response = await page.goto(`/household/requests/${DEMO_REQUEST_ID}`);
  test.skip(!response || response.status() === 404, "002's request page is not available yet");

  const card = page.getByRole("region", { name: "Solar estimate" }).first();
  await expect(card.getByText("Central subsidy", { exact: true })).toBeVisible();
  await expect(card).toContainText("₹78,000");
  await expect(card.getByText("Assumptions behind these numbers")).toBeVisible();
  await expect(card.getByText("pm-surya-ghar.v1")).toBeVisible();
  await expect(card.getByText(/Subsidy eligibility, approval and payment/)).toBeVisible();
  await expect(card.getByRole("link", { name: /Rules & sources/ })).toHaveAttribute("href", "/rules");

  // What-if preview is labelled and does not change the saved figures.
  const picker = card.getByLabel("Try a different system size");
  if (await picker.count()) {
    await picker.selectOption("5");
    await expect(card.getByText("Preview — not saved").first()).toBeVisible();
    await expect(card.getByText(/does not increase above 3 kW/)).toBeVisible();
  }
});
