import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is not set");
}

const spaDir =
  process.env["SPA_DIR"] ?? fileURLToPath(new URL("../../frontend/dist", import.meta.url));
const port = process.env["PORT"];

const app = await createApp({ databaseUrl, spaDir });
app.enableShutdownHooks();
await app.listen(Number(port ?? 3000));
