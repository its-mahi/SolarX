import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Outside the project: `next dev` watches the repo, and results written inside it cause reload loops.
  outputDir: join(tmpdir(), "suryamit-playwright"),
  fullyParallel: false,
  // One worker: every spec shares one database and the same demo accounts, so parallel runs make
  // list-count assertions flaky (other specs publish and delete requests meanwhile).
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
    },
  ],
});
