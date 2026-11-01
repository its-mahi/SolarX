import { expect, test } from "@playwright/test";
import { axeScan, newHousehold, noHorizontalScroll, removeHousehold, signIn } from "../helpers/e2e-household";
import { adminClient } from "../helpers/supabase";
import { completeDraft, createDraftViaApi, LOCATION_FIELDS, publishViaApi } from "../helpers/requests";
import type { TestUser } from "../helpers/users";

let user: TestUser;
test.beforeEach(async () => {
  user = await newHousehold();
});
test.afterEach(async () => {
  await removeHousehold(user);
});

test("a new household sees the empty state", async ({ page }) => {
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Create your solar request" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New request" }).first()).toBeVisible();
});

test("cards show status, figures and the next action for every status", async ({ page }) => {
  const admin = adminClient();
  const draft = await createDraftViaApi(user.accessToken, { ...LOCATION_FIELDS, locality: "Draftville" });
  const ids: string[] = [];
  for (const locality of ["Openpur", "Quotedpur", "Acceptedpur", "Closedpur"]) {
    const r = await completeDraft(user.accessToken);
    await admin.from("household_requests").update({ locality }).eq("id", r.id);
    expect((await publishViaApi(user.accessToken, r.id)).status).toBe(200);
    ids.push(r.id);
  }
  await admin.from("household_requests").update({ status: "quoted" }).eq("id", ids[1]);
  await admin.from("household_requests").update({ status: "accepted" }).eq("id", ids[2]);
  await admin.from("household_requests").update({ status: "accepted" }).eq("id", ids[3]);
  await admin.from("household_requests").update({ status: "closed" }).eq("id", ids[3]);

  await signIn(page, user);
  const card = (name: string) => page.getByRole("article", { name: `Request ${name}` });

  await expect(card("Draftville").getByText("Draft", { exact: true })).toBeVisible();
  await expect(card("Draftville").getByRole("link", { name: "Continue request" })).toHaveAttribute("href", `/household/requests/${draft.id}?step=photo`);

  const open = card("Openpur");
  await expect(open.getByText("Open — awaiting quotes")).toBeVisible();
  await expect(open.getByText("250 units (kWh)")).toBeVisible();
  await expect(open.getByText("₹1,50,000")).toBeVisible();
  await expect(open.getByText("3.0 kW")).toBeVisible();
  await expect(open.getByText("Waiting for vendor quotes")).toBeVisible();

  await expect(card("Quotedpur").getByRole("link", { name: "Compare quotes" })).toBeVisible();
  await expect(card("Acceptedpur").getByRole("link", { name: "View next steps" })).toBeVisible();
  await expect(card("Closedpur").getByRole("link", { name: "View request" })).toBeVisible();
});

test("a failing API shows an error state with retry", async ({ page }) => {
  await page.route("**/api/requests", (route) => route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "x", details: [] } } }));
  await signIn(page, user);
  await expect(page.getByText("We couldn't load your requests")).toBeVisible();
  await page.unroute("**/api/requests");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Create your solar request" })).toBeVisible();
});

test.describe("360 px and accessibility", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("dashboard fits 360 px and passes label/contrast checks", async ({ page }) => {
    await completeDraft(user.accessToken);
    await signIn(page, user);
    await expect(page.getByRole("article")).toBeVisible();
    await noHorizontalScroll(page);
    await axeScan(page);
  });
});
