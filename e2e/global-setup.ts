import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { baseURL } from "./playwright.config.ts";

/** Runs the production build of the app against a throwaway Postgres; the returned function stops both. */
export default async function globalSetup() {
  const database = await new PostgreSqlContainer("postgres:18-alpine").start();
  const app = spawn("node", [fileURLToPath(new URL("../backend/dist/main.js", import.meta.url))], {
    env: { ...process.env, DATABASE_URL: database.getConnectionUri(), PORT: new URL(baseURL).port },
    stdio: "inherit",
  });
  await waitForHealth(`${baseURL}/api/health`);

  return async () => {
    app.kill();
    await database.stop();
  };
}

async function waitForHealth(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${url} did not become healthy`);
}
