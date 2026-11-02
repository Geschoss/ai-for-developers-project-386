import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { bookings, calendars } from "../../platform/database/schema.js";
import type { SlotListQuery, SlotListRequest, SlotListView } from "../domain/ports/read-queries.js";
import { bookableSlots } from "../domain/slot-grid.js";

type SlotStatus = SlotListView["slots"][number]["status"];

const statusOf = (startAt: Date, takenAt: ReadonlySet<number>): SlotStatus => {
  if (takenAt.has(startAt.getTime())) {
    return "booked";
  }
  return "free";
};

/**
 * Слоты that start in [`from`, `to`). Already started and those outside the horizon are omitted.
 * `booked` comes from stored Бронирования; the guest who booked is not included.
 */
@Injectable()
class DrizzleSlotListQuery implements SlotListQuery {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async list(request: SlotListRequest): Promise<SlotListView | undefined> {
    const { from, now, slug, to } = request;
    const [calendar] = await this.db
      .select({
        id: calendars.id,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .where(eq(calendars.slug, slug.value))
      .limit(1);
    if (calendar === undefined) {
      return undefined;
    }
    const taken = await this.db
      .select({ startAt: bookings.startAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.calendarId, calendar.id),
          gte(bookings.startAt, from),
          lt(bookings.startAt, to),
        ),
      );
    const takenAt = new Set(taken.map((booking) => booking.startAt.getTime()));
    const slots = bookableSlots({
      from,
      now,
      planningHorizonDays: calendar.planningHorizonDays,
      timeZone: calendar.timeZone,
      to,
    }).map((startAt) => ({
      startAt: startAt.toISOString(),
      status: statusOf(startAt, takenAt),
    }));
    return { slots };
  }
}

export { DrizzleSlotListQuery };
