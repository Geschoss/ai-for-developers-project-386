import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { calendars, users } from "../../platform/database/schema.js";
import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import type { PublicCalendarQuery, PublicCalendarView } from "../domain/ports/read-queries.js";

interface CalendarRow {
  name: string | null;
  planningHorizonDays: number;
  timeZone: string;
}

const requirePublic = (row: CalendarRow): PublicCalendarView => {
  if (row.name === null) {
    throw new Error("Owner is missing a name");
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
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .innerJoin(users, eq(users.id, calendars.ownerId))
      .where(eq(calendars.slug, slug.value))
      .limit(1);
    if (row === undefined) {
      return undefined;
    }
    return requirePublic(row);
  }
}

export { DrizzlePublicCalendarQuery };
