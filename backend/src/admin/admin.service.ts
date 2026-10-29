import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../database/database.module.js";
import { users } from "../database/schema.js";

type Owner = components["schemas"]["Owner"];

const ownerFrom = (row: {
  calendarSlug: string | null;
  createdAt: Date;
  email: string;
  name: string | null;
  timeZone: string | null;
}): Owner => {
  if (row.name === null || row.calendarSlug === null || row.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    calendarSlug: row.calendarSlug,
    email: row.email,
    name: row.name,
    registeredAt: row.createdAt.toISOString(),
    timeZone: row.timeZone,
  };
};

/** What the Администратор reads. Read-only: there are no actions on users. */
@Injectable()
class AdminService {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every Владелец, oldest registration first. */
  public async listOwners(): Promise<Owner[]> {
    const rows = await this.db
      .select({
        calendarSlug: users.calendarSlug,
        createdAt: users.createdAt,
        email: users.email,
        name: users.name,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(eq(users.role, "owner"))
      .orderBy(asc(users.createdAt));
    return rows.map((row) => ownerFrom(row));
  }
}

export { AdminService };
