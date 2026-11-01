// Vendor quote submission smoke (specs/005 T036): submit, see active quote, My quotes, withdraw.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import "../helpers/env";
import { adminClient } from "../helpers/supabase";

const DEMO_HOUSEHOLD = "d0000000-0000-4000-8000-000000000001";
const requestId = randomUUID();
const locality = `E2E Quote ${requestId.slice(0, 8)}`;

test.beforeAll(async () => {
  const { error } = await adminClient().from("household_requests").insert({
    id: requestId,
    user_id: DEMO_HOUSEHOLD,
    latitude: 17.41,
    longitude: 78.44,
    address_text: "E2E quote smoke address",
    locality,
    monthly_units: 250,
    budget: 150000,
    roof_photo_path: `${DEMO_HOUSEHOLD}/${requestId}/a.jpg`,
    status: "open",
  });
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  await adminClient().from("household_requests").delete().eq("id", requestId);
});

test("vendor submits, reviews and withdraws a quote", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /sunrise energy/i }).click();
  await page.waitForURL("**/vendor");
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();

  await page.goto(`/vendor/requests/${requestId}/quote`);
  await expect(page.getByRole("heading", { name: "Send a quote" })).toBeVisible();
  await page.getByLabel(/Total price/).fill("165000");
  await page.getByLabel(/DC system capacity/).fill("3.3");
  await page.getByLabel(/Installation time|installation/i).first().fill("21");
  await page.getByRole("button", { name: "Submit quote" }).click();

  await expect(page.getByRole("heading", { name: "Your active quote" })).toBeVisible();
  await expect(page.getByText("Not specified").first()).toBeVisible();

  await page.getByRole("link", { name: "My quotes" }).first().click();
  await page.waitForURL("**/vendor/quotes");
  const item = page.getByTestId("quote-history-item").filter({ hasText: locality });
  await expect(item.getByText("Submitted", { exact: true })).toBeVisible();

  await item.getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Withdraw" }).click();
  await expect(item.getByText("Withdrawn", { exact: true })).toBeVisible();
  await expect(item.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
});
