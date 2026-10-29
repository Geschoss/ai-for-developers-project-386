import { fileURLToPath } from "node:url";
import { Inject, Module, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

/** Injection token for the Drizzle instance. */
export const DATABASE = Symbol("DATABASE");

const POOL = Symbol("POOL");

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

@Module({
  providers: [
    {
      provide: POOL,
      inject: [APP_OPTIONS],
      useFactory: (options: AppOptions) => new pg.Pool({ connectionString: options.databaseUrl }),
    },
    {
      provide: DATABASE,
      inject: [POOL],
      useFactory: (pool: pg.Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Brings the schema up to date before the app takes requests. */
  async onModuleInit() {
    await migrate(this.db, { migrationsFolder });
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
