// Spec 006: the owner household compares three fictional quotes, sees scores in code-determined order,
// the estimate vs vendor-confirmed markers, missing items, and the "not an official rating" disclaimer.
import { expect, test } from "@playwright/test";
import { axeScan, noHorizontalScroll, signIn } from "../helpers/e2e-household";
import { setupComparisonWorld, teardownComparisonWorld, type ComparisonWorld } from "../helpers/comparison-world";

let w: ComparisonWorld;
test.beforeAll(async () => {
  w = await setupComparisonWorld();
});
test.afterAll(() => teardownComparisonWorld(w));

test("household compares quotes with transparent scores", async ({ page }) => {
  await signIn(page, w.owner);
  await page.goto(`/household/requests/${w.requestId}/quotes`);
  await expect(page.getByRole("heading", { level: 1, name: "Compare quotes" })).toBeVisible();

  const cards = page.getByTestId("quote-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("SolarTech Test");
  await expect(cards.nth(0)).toContainText("94.8");
  await expect(cards.nth(0)).toContainText("Highest comparison score");
  await expect(cards.nth(1)).toContainText("94.3");
  await expect(cards.nth(2)).toContainText("83.1");
  await expect(cards.nth(2)).toContainText("Earthing: not stated");
  await expect(cards.nth(2)).toContainText("Not stated");

  await expect(page.getByText(/not a government, official or certification rating/)).toBeVisible();
  await expect(cards.nth(0).getByText("Estimate").first()).toBeVisible();
  await expect(cards.nth(0).getByText("Vendor-confirmed").first()).toBeVisible();

  await cards.nth(2).getByText("How this score was calculated").click();
  await expect(cards.nth(2)).toContainText("Earthing not stated (−5)");
  await expect(page.getByText(/best vendor|recommended vendor/i)).toHaveCount(0);
  await axeScan(page);
});

test("comparison fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, w.owner);
  await page.goto(`/household/requests/${w.requestId}/quotes`);
  await expect(page.getByTestId("quote-card")).toHaveCount(3);
  await noHorizontalScroll(page);
});

test("request page shows the quote count and compare link", async ({ page }) => {
  await signIn(page, w.owner);
  await page.goto(`/household/requests/${w.requestId}`);
  await expect(page.getByText("3 quotes received")).toBeVisible();
  await page.getByRole("link", { name: "Compare quotes" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/household/requests/${w.requestId}/quotes$`));
});
