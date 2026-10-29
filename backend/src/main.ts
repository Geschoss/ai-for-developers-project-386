import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const app = await createApp({
  databaseUrl,
  spaDir: process.env.SPA_DIR ?? fileURLToPath(new URL("../../frontend/dist", import.meta.url)),
});
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3000));
