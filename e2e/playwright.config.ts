import { defineConfig, devices } from "@playwright/test";

export const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "tests",
  // Starts Postgres and the built app (`pnpm e2e` builds it first).
  globalSetup: "./global-setup.ts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
