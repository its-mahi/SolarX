import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast", "label"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("360 px and accessibility", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const path of ["/", "/login", "/signup"]) {
    test(`${path} fits 360 px and passes contrast/label checks`, async ({ page }) => {
      await page.goto(path);
      await noHorizontalScroll(page);
      await axe(page);
    });
  }

  test("/account fits 360 px and passes contrast/label checks", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sunrise energy/i }).click();
    await page.waitForURL("**/vendor");
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await noHorizontalScroll(page);
    await axe(page);
  });
});
