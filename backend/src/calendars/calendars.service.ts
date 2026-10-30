import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../database/database.module.js";
import { bookings, users } from "../database/schema.js";
import { problem } from "../problem.js";
import { bookableSlots } from "./slots.js";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type SlotList = components["schemas"]["SlotList"];
type SlotStatus = components["schemas"]["Slot"]["status"];

interface OwnerRow {
  id: string;
  name: string | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

interface OwnerCalendar {
  id: string;
  name: string;
  planningHorizonDays: number;
  timeZone: string;
}

const requireOwner = (row: OwnerRow | undefined): OwnerCalendar => {
  if (row === undefined) {
    throw problem(404, "calendar_not_found");
  }
  if (row.name === null || row.planningHorizonDays === null || row.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    id: row.id,
    name: row.name,
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

/** Public calendar. A Гость sees the Владелец's name, zone and Слоты, never another Гость's name or email. */
@Injectable()
class CalendarsService {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Name, time zone and Горизонт планирования. No account fields. */
  public async getPublic(calendarSlug: string): Promise<PublicCalendar> {
    const owner = await this.owner(calendarSlug);
    return {
      ownerName: owner.name,
      planningHorizonDays: owner.planningHorizonDays,
      timeZone: owner.timeZone,
    };
  }

  /**
   * Слоты that start in [`from`, `to`). Already started and those outside the horizon are omitted.
   * `booked` comes from stored Бронирования; the guest who booked is not included.
   */
  public async listSlots(calendarSlug: string, from: Date, to: Date): Promise<SlotList> {
    const owner = await this.owner(calendarSlug);
    const taken = await this.db
      .select({ startAt: bookings.startAt })
      .from(bookings)
      .where(
        and(eq(bookings.ownerId, owner.id), gte(bookings.startAt, from), lt(bookings.startAt, to)),
      );
    const takenAt = new Set(taken.map((row) => row.startAt.getTime()));
    const slots = bookableSlots({
      from,
      now: new Date(),
      planningHorizonDays: owner.planningHorizonDays,
      timeZone: owner.timeZone,
      to,
    }).map((startAt) => ({
      startAt: startAt.toISOString(),
      status: statusOf(startAt, takenAt),
    }));
    return { slots };
  }

  private async owner(calendarSlug: string): Promise<OwnerCalendar> {
    const [row] = await this.db
      .select({
        id: users.id,
        name: users.name,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.calendarSlug, calendarSlug), eq(users.role, "owner")))
      .limit(1);
    return requireOwner(row);
  }
}

export { CalendarsService };
