import { Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";

import { bookings, users } from "../../platform/database/schema.js";
import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import { Calendar } from "../domain/calendar.js";
import type { CalendarRepository } from "../domain/ports/calendar-repository.js";
import { SchedulingError } from "../domain/scheduling-error.js";
import { civilDayBounds } from "../domain/slot-grid.js";
import { currentTransaction } from "./transaction-context.js";

interface OwnerRow {
  dailyBookingLimit: number | null;
  id: string;
  name: string | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Unique index `bookings_owner_start_unique` is the guarantee; this only names the error (ADR-0003). */
const slotAlreadyTaken = (error: unknown): boolean => {
  if (!isRecord(error) || !isRecord(error["cause"])) {
    return false;
  }
  return (
    error["cause"]["code"] === "23505" &&
    error["cause"]["constraint"] === "bookings_owner_start_unique"
  );
};

const requireFields = (
  row: OwnerRow,
): {
  dailyBookingLimit: number;
  id: string;
  name: string;
  planningHorizonDays: number;
  timeZone: string;
} => {
  if (
    row.name === null ||
    row.planningHorizonDays === null ||
    row.timeZone === null ||
    row.dailyBookingLimit === null
  ) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    dailyBookingLimit: row.dailyBookingLimit,
    id: row.id,
    name: row.name,
    planningHorizonDays: row.planningHorizonDays,
    timeZone: row.timeZone,
  };
};

/** Loads one civil day under `SELECT … FOR UPDATE` and inserts only the Бронирования `book` added. */
@Injectable()
class DrizzleCalendarRepository implements CalendarRepository {
  private readonly openTransaction = currentTransaction;

  public async loadLocked(slug: CalendarSlug, startAt: Date): Promise<Calendar | undefined> {
    const transaction = this.openTransaction();
    const [row] = await transaction
      .select({
        dailyBookingLimit: users.dailyBookingLimit,
        id: users.id,
        name: users.name,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.calendarSlug, slug.value), eq(users.role, "owner")))
      .limit(1)
      .for("update");
    if (row === undefined) {
      return undefined;
    }
    const owner = requireFields(row);
    const day = civilDayBounds(startAt, owner.timeZone);
    const stored = await transaction
      .select({
        guestEmail: bookings.guestEmail,
        guestName: bookings.guestName,
        id: bookings.id,
        startAt: bookings.startAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.ownerId, owner.id),
          gte(bookings.startAt, day.from),
          lt(bookings.startAt, day.to),
        ),
      );
    return Calendar.load({
      bookings: stored,
      dailyBookingLimit: owner.dailyBookingLimit,
      dayFrom: day.from,
      dayTo: day.to,
      ownerId: owner.id,
      ownerName: owner.name,
      planningHorizonDays: owner.planningHorizonDays,
      slug: slug.value,
      timeZone: owner.timeZone,
    });
  }

  public async save(calendar: Calendar): Promise<void> {
    const added = calendar.addedBookings();
    if (added.length === 0) {
      return;
    }
    const transaction = this.openTransaction();
    try {
      await transaction.insert(bookings).values(
        added.map((booking) => ({
          guestEmail: booking.guestEmail,
          guestName: booking.guestName,
          id: booking.id,
          ownerId: calendar.ownerId,
          startAt: booking.startAt,
        })),
      );
    } catch (error) {
      if (slotAlreadyTaken(error)) {
        throw new SchedulingError("slot_taken");
      }
      throw error;
    }
  }
}

export { DrizzleCalendarRepository };
