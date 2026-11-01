import { expect, test, type Page } from "@playwright/test";

async function demoSignIn(page: Page, button: RegExp, home: string) {
  await page.goto("/");
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(`**${home}`);
  // Wait for the signed-in shell so the session cookie is settled before the next navigation.
  await expect(page.getByRole("button", { name: /account menu for/i })).toBeVisible();
}

test("anonymous visitors of /household are sent to login with next", async ({ page }) => {
  await page.goto("/household");
  await expect(page).toHaveURL(/\/login\?next=%2Fhousehold$/);
});

test("a household opening /vendor is redirected home", async ({ page }) => {
  await demoSignIn(page, /try as demo household/i, "/household");
  await page.goto("/vendor");
  await expect(page).toHaveURL(/\/household$/);
});

test("a vendor opening /household is redirected home", async ({ page }) => {
  await demoSignIn(page, /sunrise energy/i, "/vendor");
  await page.goto("/household");
  await expect(page).toHaveURL(/\/vendor$/);
});

test("an external next= value is ignored after sign-in", async ({ page }) => {
  await page.goto("/login?next=https://evil.example");
  await page.getByLabel("Email").fill("demo-household@example.com");
  await page.getByLabel("Password").fill(process.env.DEMO_ACCOUNT_PASSWORD ?? "suryamit-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/household");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/household");
  expect(url.hostname).toBe("127.0.0.1"); // never redirected to the external next= host
});
