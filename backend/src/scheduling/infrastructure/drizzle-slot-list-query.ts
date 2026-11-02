import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { bookings, users } from "../../platform/database/schema.js";
import type { SlotListQuery, SlotListRequest, SlotListView } from "../domain/ports/read-queries.js";
import { bookableSlots } from "../domain/slot-grid.js";

type SlotStatus = SlotListView["slots"][number]["status"];

interface OwnerRow {
  id: string;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

const requireOwner = (
  row: OwnerRow,
): { id: string; planningHorizonDays: number; timeZone: string } => {
  if (row.planningHorizonDays === null || row.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    id: row.id,
    planningHorizonDays: row.planningHorizonDays,
    timeZone: row.timeZone,
  };
};

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
    const [row] = await this.db
      .select({
        id: users.id,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.calendarSlug, slug.value), eq(users.role, "owner")))
      .limit(1);
    if (row === undefined) {
      return undefined;
    }
    const owner = requireOwner(row);
    const taken = await this.db
      .select({ startAt: bookings.startAt })
      .from(bookings)
      .where(
        and(eq(bookings.ownerId, owner.id), gte(bookings.startAt, from), lt(bookings.startAt, to)),
      );
    const takenAt = new Set(taken.map((booking) => booking.startAt.getTime()));
    const slots = bookableSlots({
      from,
      now,
      planningHorizonDays: owner.planningHorizonDays,
      timeZone: owner.timeZone,
      to,
    }).map((startAt) => ({
      startAt: startAt.toISOString(),
      status: statusOf(startAt, takenAt),
    }));
    return { slots };
  }
}

export { DrizzleSlotListQuery };
