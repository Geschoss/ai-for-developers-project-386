import { Module } from "@nestjs/common";

interface AppOptions {
  /** Администратор to create at startup when the database has none. From `ADMIN_EMAIL` / `ADMIN_PASSWORD`. */
  admin: { email: string; password: string };
  databaseUrl: string;
  /** Directory with the built SPA; its `index.html` answers every non-API GET. */
  spaDir: string;
}

/** Injection token for {@link AppOptions}. */
const APP_OPTIONS = Symbol("APP_OPTIONS");

/** Nest module identity for the {@link AppOptions} provider. */
@Module({})
class AppOptionsModule {}

export { APP_OPTIONS, AppOptionsModule, type AppOptions };
