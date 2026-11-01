import { expect, test } from "@playwright/test";
import { freshContextPage, newHousehold, removeHousehold, signIn } from "../helpers/e2e-household";
import { jpegWithGps, writeTempImage } from "../helpers/images";
import { completeDraft, publishViaApi } from "../helpers/requests";
import type { TestUser } from "../helpers/users";

let user: TestUser;
test.beforeEach(async () => {
  user = await newHousehold();
});
test.afterEach(async () => {
  await removeHousehold(user);
});

test("a draft resumes at the right step with values restored, and edits are kept", async ({ page, browser }) => {
  await signIn(page, user);
  await page.goto("/household/requests/new");
  await page.getByLabel("Latitude", { exact: true }).fill("17.412345");
  await page.getByLabel("Longitude", { exact: true }).fill("78.44321");
  await page.getByLabel("Address", { exact: true }).fill("Plot 12, Road 3, Banjara Hills, Hyderabad 500034");
  await page.getByLabel("Locality or area").fill("Banjara Hills");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=photo/);
  await page.locator("#roof_photo").setInputFiles(await writeTempImage(await jpegWithGps()));
  await expect(page.getByAltText("Your uploaded roof photo")).toBeVisible();

  // A different browser context stands in for "closed the browser and came back later".
  const later = await freshContextPage(browser);
  await signIn(later, user);
  await later.getByRole("link", { name: "Continue request" }).click();
  await expect(later.getByRole("heading", { name: "Usage and budget", level: 2 })).toBeVisible();
  await later.getByRole("button", { name: "Back" }).click();
  await expect(later.getByAltText("Your uploaded roof photo")).toBeVisible();
  await later.getByRole("button", { name: "Back" }).click();
  await expect(later.getByLabel("Address", { exact: true })).toHaveValue("Plot 12, Road 3, Banjara Hills, Hyderabad 500034");
  await expect(later.getByLabel("Locality or area")).toHaveValue("Banjara Hills");

  // Finish and change the address through the review Edit link.
  await later.getByRole("button", { name: "Continue" }).click();
  await later.getByRole("button", { name: "Continue" }).click();
  await later.getByLabel(/Monthly electricity use/).fill("250");
  await later.getByLabel(/^Budget/).fill("150000");
  await later.getByRole("button", { name: "Continue" }).click();
  await expect(later.getByRole("heading", { name: "Review", level: 2 })).toBeVisible();
  await later.getByRole("button", { name: "Edit location" }).click();
  await later.getByLabel("Address", { exact: true }).fill("New address, Jubilee Hills, Hyderabad");
  await later.getByRole("button", { name: "Continue" }).click();
  await later.getByRole("button", { name: "Continue" }).click();
  await later.getByRole("button", { name: "Continue" }).click();
  await expect(later.getByText("New address, Jubilee Hills, Hyderabad")).toBeVisible();
  await later.context().close();
});

test("consent can be withdrawn on a published request but not given again", async ({ page }) => {
  const draft = await completeDraft(user.accessToken);
  await fetch(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000"}/api/requests/${draft.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${user.accessToken}`, "content-type": "application/json", origin: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000" },
    body: JSON.stringify({ ai_consent: true }),
  });
  expect((await publishViaApi(user.accessToken, draft.id)).status).toBe(200);

  await signIn(page, user);
  await page.goto(`/household/requests/${draft.id}`);
  await page.getByRole("button", { name: "Withdraw AI analysis consent" }).click();
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await expect(page.getByText(/AI analysis consent withdrawn/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Withdraw AI analysis consent" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Consent can only be given before publishing/)).toBeVisible();
});
