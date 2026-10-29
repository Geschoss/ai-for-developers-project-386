import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";
const desktopChrome = devices["Desktop Chrome"];

const config = defineConfig({
  globalSetup: "./global-setup.ts",
  projects: [{ name: "chromium", use: { ...desktopChrome } }],
  testDir: "tests",
  // Starts Postgres and the built app (`pnpm e2e` builds it first).
  use: { baseURL, trace: "retain-on-failure" },
});

export { baseURL };
export default config;
