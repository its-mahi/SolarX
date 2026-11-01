import { expect, test, type Page } from "@playwright/test";
import { axeScan, newHousehold, noHorizontalScroll, removeHousehold, signIn } from "../helpers/e2e-household";
import { jpegWithGps, writeTempImage } from "../helpers/images";
import type { TestUser } from "../helpers/users";

let user: TestUser;
test.beforeEach(async () => {
  user = await newHousehold();
});
test.afterEach(async () => {
  await removeHousehold(user);
});

async function fillLocation(page: Page) {
  await page.getByLabel("Latitude", { exact: true }).fill("17.412345");
  await page.getByLabel("Longitude", { exact: true }).fill("78.44321");
  await page.getByLabel("Address", { exact: true }).fill("Plot 12, Road 3, Banjara Hills, Hyderabad 500034");
  await page.getByLabel("Locality or area").fill("Banjara Hills");
}

async function uploadRoof(page: Page) {
  const file = await writeTempImage(await jpegWithGps());
  await page.locator("#roof_photo").setInputFiles(file);
  await expect(page.getByAltText("Your uploaded roof photo")).toBeVisible();
}

test("household creates and publishes a request", async ({ page }) => {
  await signIn(page, user);
  await page.getByRole("link", { name: "New request" }).first().click();
  await expect(page.getByRole("heading", { name: "Location", level: 2 })).toBeVisible();

  await fillLocation(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/household\/requests\/[0-9a-f-]{36}\?step=photo$/);

  await uploadRoof(page);
  await page.getByLabel(/Allow SolarX to send this roof photo/).check();
  await expect(page.getByLabel(/Allow SolarX to send this roof photo/)).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/Monthly electricity use/).fill("250");
  await page.getByLabel(/Monthly bill/).fill("2100");
  await page.getByLabel(/^Budget/).fill("150000");
  await page.getByLabel(/Preferred capacity/).fill("3");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Review", level: 2 })).toBeVisible();
  await expect(page.getByText("250 units (kWh)")).toBeVisible();
  await expect(page.getByText("₹1,50,000")).toBeVisible();
  await expect(page.getByText("3.0 kW")).toBeVisible();
  await expect(page.getByText(/Vendors will not see/).first()).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish request" }).click();

  await expect(page.getByText("Open — awaiting quotes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);

  // A published request opened with a wizard step shows the read-only page.
  await page.goto(`${page.url().split("?")[0]}?step=usage`);
  await expect(page.getByText("Open — awaiting quotes")).toBeVisible();
});

test("publish stays disabled until everything is filled in, and errors are specific", async ({ page }) => {
  await signIn(page, user);
  await page.goto("/household/requests/new");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Place a pin on the map or enter a latitude")).toBeVisible();

  await page.getByLabel("Latitude", { exact: true }).fill("51.5");
  await page.getByLabel("Longitude", { exact: true }).fill("78.4");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("SolarX currently supports locations in India")).toBeVisible();

  await fillLocation(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=photo/);

  const bad = await writeTempImage(Buffer.from("not an image"), "roof.jpg");
  await page.locator("#roof_photo").setInputFiles(bad);
  await expect(page.getByText("Upload a JPEG, PNG or WebP photo")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Monthly electricity use/).fill("0");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Must be 1 or more")).toBeVisible();
  await page.getByLabel(/Monthly electricity use/).fill("250");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Review", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  await expect(page.getByText("Complete these items before publishing:")).toBeVisible();
  await expect(page.getByRole("button", { name: /go to Roof photo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /go to Usage and budget/ })).toBeVisible();
});

test.describe("360 px and accessibility", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("every wizard step fits 360 px and passes label/contrast checks", async ({ page }) => {
    await signIn(page, user);
    await page.goto("/household/requests/new");
    await expect(page.getByLabel("Latitude", { exact: true })).toBeVisible();
    await noHorizontalScroll(page);
    await axeScan(page);
    await fillLocation(page);
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/step=photo/);
    await uploadRoof(page);
    await noHorizontalScroll(page);
    await axeScan(page);
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel(/Monthly electricity use/).fill("250");
    await page.getByLabel(/^Budget/).fill("150000");
    await noHorizontalScroll(page);
    await axeScan(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Review", level: 2 })).toBeVisible();
    await noHorizontalScroll(page);
    await axeScan(page);
    await page.getByRole("button", { name: "Publish", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
  });
});
