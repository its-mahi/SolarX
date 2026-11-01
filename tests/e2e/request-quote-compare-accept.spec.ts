// P0 end-to-end flow (plan §18, specs/007 T034): request -> three vendor quotes -> compare ->
// accept one -> statuses, next steps, duplicate-accept refusal, vendor-side outcomes.
//
// The request is seeded through the admin client (the wizard itself is covered by
// tests/e2e/household-request.spec.ts) and deleted afterwards, so the seeded Sharma request and its
// three demo quotes are never touched. Vendors submit through the real quote API with their own
// browser session; everything the household and vendors see goes through the real pages.
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import "../helpers/env";
import { adminClient } from "../helpers/supabase";
import { completeQuote } from "../fixtures/quote-inputs";
import { axeScan, noHorizontalScroll } from "../helpers/e2e-household";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const DEMO_HOUSEHOLD = "d0000000-0000-4000-8000-000000000001";
const requestId = randomUUID();
const locality = `E2E P0 ${requestId.slice(0, 8)}`;

const VENDORS = {
  sunrise: { button: /sunrise energy/i, company: "SunRise Energy" },
  greenvolt: { button: /greenvolt solar/i, company: "GreenVolt Solar" },
  solartech: { button: /solartech solutions/i, company: "SolarTech Solutions" },
} as const;

// Three quotes with different strengths (plan §16): complete, cheapest-but-incomplete, premium and fast.
const QUOTES = {
  sunrise: { ...completeQuote, request_id: requestId, price: 165000, capacity_kw: 3.3 },
  greenvolt: {
    request_id: requestId,
    price: 140000,
    capacity_kw: 3,
    panel_details: { brand: "Demo GreenCell", wattage: 550, quantity: 6 },
    inverter_details: { brand: "Demo GreenInvert", type: "on-grid" },
    warranty_details: { performance_years: 25 },
    installation_days: 18,
    earthing_included: null, // the missing item the comparison must flag
    documentation_included: true,
    other_inclusions: [],
  },
  solartech: {
    ...completeQuote,
    request_id: requestId,
    price: 195000,
    capacity_kw: 3.3,
    installation_days: 10,
    warranty_details: { panel_product_years: 15, performance_years: 30, inverter_years: 12, workmanship_years: 8 },
  },
};

const opened: BrowserContext[] = [];

async function demoPage(browser: Browser, button: RegExp, home: "/household" | "/vendor"): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  opened.push(context);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(`**${home}`);
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();
  return page;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { error } = await adminClient().from("household_requests").insert({
    id: requestId,
    user_id: DEMO_HOUSEHOLD,
    latitude: 17.41,
    longitude: 78.44,
    address_text: "E2E P0 flow address",
    locality,
    monthly_units: 250,
    budget: 150000,
    preferred_capacity_kw: 3,
    roof_photo_path: `${DEMO_HOUSEHOLD}/${requestId}/a.jpg`,
    status: "open",
  });
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  for (const context of opened) await context.close().catch(() => undefined);
  await adminClient().from("household_requests").delete().eq("id", requestId); // cascades quotes + acceptance
});

test("request -> quotes -> compare -> accept -> outcomes", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Flow is identical on mobile; phone layouts are covered by their own specs");
  test.setTimeout(120_000);

  // 1. Each demo vendor sees the open request and submits a quote.
  const vendorPages = {} as Record<keyof typeof VENDORS, Page>;
  for (const key of Object.keys(VENDORS) as (keyof typeof VENDORS)[]) {
    const page = await demoPage(browser, VENDORS[key].button, "/vendor");
    vendorPages[key] = page;

    const detail = await page.goto(`/vendor/requests/${requestId}`);
    expect(detail?.status()).toBe(200);
    await expect(page.getByText(locality).first()).toBeVisible();

    const res = await page.request.post("/api/quotes", { data: QUOTES[key], headers: { origin: BASE_URL } });
    expect(res.status(), `${key} quote submit`).toBe(201);
  }

  // 2. The household sees all three quotes with scores, a missing-item flag on GreenVolt and the disclaimer.
  const household = await demoPage(browser, /try as demo household/i, "/household");
  await household.goto(`/household/requests/${requestId}/quotes`);
  const cards = household.getByTestId("quote-card");
  await expect(cards).toHaveCount(3);
  await expect(household.getByLabel("How scores work")).toBeVisible();
  for (const { company } of Object.values(VENDORS)) {
    const card = cards.filter({ hasText: company });
    await expect(card.getByTestId("quote-score")).toContainText("/ 100");
  }
  await expect(cards.filter({ hasText: VENDORS.greenvolt.company })).toContainText("Not stated by the vendor");
  await expect(cards.filter({ hasText: VENDORS.sunrise.company })).toContainText("All recommended details provided");

  const quoteIds: Record<string, string> = {};
  for (const [key, { company }] of Object.entries(VENDORS)) {
    quoteIds[key] = (await cards.filter({ hasText: company }).getAttribute("data-quote-id")) ?? "";
    expect(quoteIds[key]).toMatch(/^[0-9a-f-]{36}$/);
  }

  // 3. Accept one quote through the confirmation dialog.
  await cards.filter({ hasText: VENDORS.sunrise.company }).getByRole("button", { name: "Accept quote" }).click();
  const dialog = household.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Accept SunRise Energy/ })).toBeVisible();
  await axeScan(household); // the confirmation dialog is accessible (spec 007 T036)
  await dialog.getByRole("button", { name: "Accept quote" }).click();
  await expect(dialog).toBeHidden();

  // 4. Statuses update on the comparison page and next steps appear on the request page.
  await expect(cards.filter({ hasText: VENDORS.sunrise.company }).getByText("Accepted", { exact: true })).toBeVisible();
  await expect(cards.filter({ hasText: VENDORS.greenvolt.company }).getByText("Not selected", { exact: true })).toBeVisible();
  await expect(cards.filter({ hasText: VENDORS.solartech.company }).getByText("Not selected", { exact: true })).toBeVisible();
  await household.goto(`/household/requests/${requestId}`);
  await expect(household.getByRole("heading", { name: "Quote accepted" })).toBeVisible();
  await expect(household.getByText(VENDORS.sunrise.company).first()).toBeVisible();
  await axeScan(household);
  await household.setViewportSize({ width: 375, height: 800 });
  await noHorizontalScroll(household); // next steps fit a 375 px phone (spec 007 T036)
  await household.setViewportSize({ width: 1280, height: 800 });

  // 5. A second acceptance attempt is refused.
  const second = await household.request.post(`/api/quotes/${quoteIds.greenvolt}/accept`, { data: { confirmed: true }, headers: { origin: BASE_URL } });
  expect(second.status()).toBe(409);
  expect((await second.json()).error.code).toBe("CONFLICT");
  const again = await household.request.post(`/api/quotes/${quoteIds.sunrise}/accept`, { data: { confirmed: true }, headers: { origin: BASE_URL } });
  expect(again.status()).toBe(409);

  // 6. The accepted vendor sees "Accepted" and the household contact; a rejected vendor sees "Not selected".
  const winner = vendorPages.sunrise;
  await winner.goto("/vendor/quotes");
  const winnerItem = winner.getByTestId("quote-history-item").filter({ hasText: locality });
  await expect(winnerItem.getByText("Accepted by the household — arrange a site survey")).toBeVisible();
  await winnerItem.getByRole("button", { name: "View household contact" }).click();
  await expect(winner.getByRole("dialog").getByText("Sharma Residence")).toBeVisible();
  await winner.keyboard.press("Escape");

  const loser = vendorPages.greenvolt;
  await loser.goto("/vendor/quotes");
  const loserItem = loser.getByTestId("quote-history-item").filter({ hasText: locality });
  await expect(loserItem.getByText("Not selected — the household accepted another quote")).toBeVisible();
  await expect(loserItem.getByRole("button", { name: "View household contact" })).toHaveCount(0);
  const contact = await loser.request.get(`/api/quotes/${quoteIds.greenvolt}/contact`);
  expect(contact.status()).toBeGreaterThanOrEqual(400); // a rejected vendor never gets the household's details
});
