export interface AppOptions {
  databaseUrl: string;
  /** Directory with the built SPA; its `index.html` answers every non-API GET. */
  spaDir: string;
}

/** Injection token for {@link AppOptions}. */
export const APP_OPTIONS = Symbol("APP_OPTIONS");
