import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { users } from "../../platform/database/schema.js";
import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import type { PublicCalendarQuery, PublicCalendarView } from "../domain/ports/read-queries.js";

interface OwnerRow {
  name: string | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

const requirePublic = (row: OwnerRow): PublicCalendarView => {
  if (row.name === null || row.planningHorizonDays === null || row.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    ownerName: row.name,
    planningHorizonDays: row.planningHorizonDays,
    timeZone: row.timeZone,
  };
};

/** The public page. No lock, no Бронирования. */
@Injectable()
class DrizzlePublicCalendarQuery implements PublicCalendarQuery {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async find(slug: CalendarSlug): Promise<PublicCalendarView | undefined> {
    const [row] = await this.db
      .select({
        name: users.name,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.calendarSlug, slug.value), eq(users.role, "owner")))
      .limit(1);
    if (row === undefined) {
      return undefined;
    }
    return requirePublic(row);
  }
}

export { DrizzlePublicCalendarQuery };
