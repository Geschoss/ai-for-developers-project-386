import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../database/database.module.js";
import { bookings, users } from "../database/schema.js";
import { problem } from "../problem.js";
import { bookableSlots, isSlotStart } from "./slots.js";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];
type BookingRequest = components["schemas"]["BookingRequest"];
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

const rethrowSlotTaken = (error: unknown): void => {
  if (slotAlreadyTaken(error)) {
    throw problem(409, "slot_taken");
  }
  throw error;
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

  /** Stores a Бронирование and returns what the «Вы записаны» screen shows. */
  public async createBooking(
    calendarSlug: string,
    booking: BookingRequest,
  ): Promise<BookingConfirmation> {
    const owner = await this.owner(calendarSlug);
    const startAt = new Date(booking.startAt);
    if (!isSlotStart(startAt, owner.timeZone)) {
      throw problem(422, "not_a_slot_start");
    }
    await this.storeBooking(owner.id, startAt, booking.guest);
    return {
      ownerName: owner.name,
      ownerTimeZone: owner.timeZone,
      startAt: startAt.toISOString(),
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

  /**
   * A prior read names `slot_taken` when the Слот is already gone.
   * Two inserts that both pass that read still collide on the unique index, which becomes the same error.
   */
  private async storeBooking(
    ownerId: string,
    startAt: Date,
    guest: BookingRequest["guest"],
  ): Promise<void> {
    const [existing] = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.ownerId, ownerId), eq(bookings.startAt, startAt)))
      .limit(1);
    if (existing !== undefined) {
      throw problem(409, "slot_taken");
    }
    try {
      await this.db.insert(bookings).values({
        guestEmail: guest.email,
        guestName: guest.name,
        id: randomUUID(),
        ownerId,
        startAt,
      });
    } catch (error) {
      rethrowSlotTaken(error);
    }
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
