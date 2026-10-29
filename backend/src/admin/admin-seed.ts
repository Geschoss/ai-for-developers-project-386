import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { hashPassword } from "../accounts/passwords.js";
import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import { DATABASE, type Database } from "../database/database.module.js";
import { users } from "../database/schema.js";

/**
 * Creates the Администратор from {@link AppOptions.admin} once migrations have run. Nothing happens when one already
 * exists, even under another email: there is a single Администратор, and `users_single_admin` guards it.
 */
@Injectable()
class AdminSeed implements OnApplicationBootstrap {
  public constructor(
    @Inject(APP_OPTIONS) private readonly options: AppOptions,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    if (existing !== undefined) {
      return;
    }
    const email = this.options.admin.email.toLowerCase();
    const [taken] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (taken !== undefined) {
      throw new Error(`ADMIN_EMAIL ${email} already belongs to an owner`);
    }
    const passwordHash = await hashPassword(this.options.admin.password);
    // Another instance starting at the same time may win; `users_single_admin` keeps it to one.
    await this.db
      .insert(users)
      .values({ email, id: randomUUID(), passwordHash, role: "admin" })
      .onConflictDoNothing();
  }
}

export { AdminSeed };
