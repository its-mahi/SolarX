// Browser helpers: a throw-away household user signed in through the real login form.
import "./env";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";
import { adminClient } from "./supabase";
import { createTestUser, deleteTestUser, type TestUser } from "./users";

export async function newHousehold(): Promise<TestUser> {
  return createTestUser({ role: "household" });
}

export async function removeHousehold(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await adminClient().from("household_requests").delete().eq("user_id", user.id);
  const admin = adminClient();
  const { data: folders } = await admin.storage.from("roof-photos").list(user.id);
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from("roof-photos").list(`${user.id}/${folder.name}`);
    await admin.storage.from("roof-photos").remove((files ?? []).map((f) => `${user.id}/${folder.name}/${f.name}`));
  }
  await deleteTestUser(user.id);
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  // Wait until React has hydrated the form so the click is handled by React, not a native submit.
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return !!form && Object.keys(form).some((k) => k.startsWith("__reactProps"));
  });
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/household");
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();
}

export async function freshContextPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000" });
  return context.newPage();
}

export async function noHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

export async function axeScan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast", "label", "button-name", "link-name"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
