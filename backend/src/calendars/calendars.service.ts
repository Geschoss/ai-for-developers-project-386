import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";
import type { components } from "spec/api";

import { AccountsService } from "../accounts/accounts.service.js";
import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import { DATABASE, type Database } from "../database/database.module.js";
import { bookings, users } from "../database/schema.js";
import { problem } from "../problem.js";
import { bookableSlots, isSlotStart, withinPlanningHorizon } from "./slots.js";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];
type BookingRequest = components["schemas"]["BookingRequest"];
type CurrentUser = components["schemas"]["CurrentUser"];
type PublicCalendar = components["schemas"]["PublicCalendar"];
type SlotList = components["schemas"]["SlotList"];
type SlotStatus = components["schemas"]["Slot"]["status"];

/** The client Drizzle hands to a `transaction` callback: same queries, one locked unit of work. */
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

/** A logged-in Владелец has no Гость path on their own calendar. Anyone else, including an anonymous visitor, does. */
const isOwnCalendar = (viewer: CurrentUser | undefined, calendarSlug: string): boolean => {
  if (viewer === undefined || viewer.role !== "owner") {
    return false;
  }
  return viewer.calendarSlug === calendarSlug;
};

/**
 * Grid, then the past, then the Горизонт планирования. A started Слот is `slot_in_past` even on today's date;
 * a later day is `outside_planning_horizon`.
 */
const rejectUnbookable = (startAt: Date, owner: OwnerCalendar, now: Date): void => {
  if (!isSlotStart(startAt, owner.timeZone)) {
    throw problem(422, "not_a_slot_start");
  }
  if (startAt.getTime() <= now.getTime()) {
    throw problem(422, "slot_in_past");
  }
  if (
    !withinPlanningHorizon({
      now,
      planningHorizonDays: owner.planningHorizonDays,
      start: startAt,
      timeZone: owner.timeZone,
    })
  ) {
    throw problem(422, "outside_planning_horizon");
  }
};

interface StoredBooking {
  guest: BookingRequest["guest"];
  ownerId: string;
  startAt: Date;
}

/**
 * A prior read names `slot_taken` when the Слот is already gone.
 * Two inserts that both pass that read still collide on the unique index, which becomes the same error.
 * Runs on the transaction that already holds the Владелец row (ADR-0003).
 */
const insertBooking = async (tx: Transaction, stored: StoredBooking): Promise<void> => {
  const [existing] = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.ownerId, stored.ownerId), eq(bookings.startAt, stored.startAt)))
    .limit(1);
  if (existing !== undefined) {
    throw problem(409, "slot_taken");
  }
  try {
    await tx.insert(bookings).values({
      guestEmail: stored.guest.email,
      guestName: stored.guest.name,
      id: randomUUID(),
      ownerId: stored.ownerId,
      startAt: stored.startAt,
    });
  } catch (error) {
    rethrowSlotTaken(error);
  }
};

/** The Владелец row, locked until the Бронирование commits. Later checks read this snapshot. */
const lockedOwner = async (tx: Transaction, calendarSlug: string): Promise<OwnerCalendar> => {
  const [row] = await tx
    .select({
      id: users.id,
      name: users.name,
      planningHorizonDays: users.planningHorizonDays,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(and(eq(users.calendarSlug, calendarSlug), eq(users.role, "owner")))
    .limit(1)
    .for("update");
  return requireOwner(row);
};

/** Public calendar. A Гость sees the Владелец's name, zone and Слоты, never another Гость's name or email. */
@Injectable()
class CalendarsService {
  public constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(APP_OPTIONS) private readonly options: AppOptions,
  ) {}

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
   * Stores a Бронирование and returns what the «Вы записаны» screen shows.
   * The Горизонт планирования is read under `SELECT … FOR UPDATE` in the same transaction as the insert
   * (ADR-0003). The Лимит бронирований will use this same locked transaction.
   */
  public async createBooking(
    calendarSlug: string,
    booking: BookingRequest,
    sessionId: string | undefined,
  ): Promise<BookingConfirmation> {
    const viewer = await this.accounts.findUser(sessionId);
    if (isOwnCalendar(viewer, calendarSlug)) {
      throw problem(422, "own_calendar");
    }
    const startAt = new Date(booking.startAt);
    const now = this.now();
    return this.db.transaction(async (tx) => {
      const owner = await lockedOwner(tx, calendarSlug);
      rejectUnbookable(startAt, owner, now);
      await insertBooking(tx, { guest: booking.guest, ownerId: owner.id, startAt });
      return {
        ownerName: owner.name,
        ownerTimeZone: owner.timeZone,
        startAt: startAt.toISOString(),
      };
    });
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
      now: this.now(),
      planningHorizonDays: owner.planningHorizonDays,
      timeZone: owner.timeZone,
      to,
    }).map((startAt) => ({
      startAt: startAt.toISOString(),
      status: statusOf(startAt, takenAt),
    }));
    return { slots };
  }

  private now(): Date {
    const clock = this.options.now;
    if (clock === undefined) {
      return new Date();
    }
    return clock();
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
