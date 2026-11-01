import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt } from "drizzle-orm";
import type { components } from "spec/api";

import { AccountsService } from "../accounts/accounts.service.js";
import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import { DATABASE, type Database } from "../database/database.module.js";
import { bookings, users } from "../database/schema.js";
import { problem } from "../problem.js";
import { assertKnownTimeZone } from "../time-zone.js";

type Booking = components["schemas"]["Booking"];
type CurrentOwner = components["schemas"]["CurrentOwner"];
type OwnerSettings = components["schemas"]["OwnerSettings"];

interface BookingRow {
  createdAt: Date;
  guestEmail: string;
  guestName: string;
  id: string;
  startAt: Date;
}

interface SettingsRow {
  dailyBookingLimit: number | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

const bookingFrom = (row: BookingRow): Booking => ({
  createdAt: row.createdAt.toISOString(),
  guest: { email: row.guestEmail, name: row.guestName },
  id: row.id,
  startAt: row.startAt.toISOString(),
});

const settingsFrom = (row: SettingsRow | undefined): OwnerSettings => {
  if (
    row === undefined ||
    row.dailyBookingLimit === null ||
    row.planningHorizonDays === null ||
    row.timeZone === null
  ) {
    throw new Error("Owner is missing calendar settings");
  }
  return {
    dailyBookingLimit: row.dailyBookingLimit,
    planningHorizonDays: row.planningHorizonDays,
    timeZone: row.timeZone,
  };
};

/**
 * The Владелец's own calendar: settings and the upcoming Бронирования.
 * A settings change writes only those three columns. Existing Бронирования stay, because they are
 * absolute instants, and a smaller Горизонт планирования or Лимит бронирований does not remove them.
 */
@Injectable()
class OwnerService {
  public constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(APP_OPTIONS) private readonly options: AppOptions,
  ) {}

  /**
   * Бронирования whose start is still ahead, soonest first.
   * A start that has already come — including this exact instant — is no longer upcoming.
   * Another Владелец's rows never appear: the query is the session's own calendar.
   */
  public async listUpcoming(sessionId: string | undefined): Promise<Booking[]> {
    const ownerId = await this.ownerId(sessionId);
    const current = this.now();
    const rows = await this.db
      .select({
        createdAt: bookings.createdAt,
        guestEmail: bookings.guestEmail,
        guestName: bookings.guestName,
        id: bookings.id,
        startAt: bookings.startAt,
      })
      .from(bookings)
      .where(and(eq(bookings.ownerId, ownerId), gt(bookings.startAt, current)))
      .orderBy(asc(bookings.startAt));
    return rows.map((row) => bookingFrom(row));
  }

  /** Settings stored for the Владелец behind `sid`. */
  public async getSettings(sessionId: string | undefined): Promise<OwnerSettings> {
    const owner = await this.owner(sessionId);
    const [row] = await this.db
      .select({
        dailyBookingLimit: users.dailyBookingLimit,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.email, owner.email), eq(users.role, "owner")))
      .limit(1);
    return settingsFrom(row);
  }

  /** Replaces all three settings. An unknown time zone is `validation_failed`. */
  public async updateSettings(
    sessionId: string | undefined,
    settings: OwnerSettings,
  ): Promise<OwnerSettings> {
    const owner = await this.owner(sessionId);
    assertKnownTimeZone(settings.timeZone);
    const [row] = await this.db
      .update(users)
      .set({
        dailyBookingLimit: settings.dailyBookingLimit,
        planningHorizonDays: settings.planningHorizonDays,
        timeZone: settings.timeZone,
      })
      .where(and(eq(users.email, owner.email), eq(users.role, "owner")))
      .returning({
        dailyBookingLimit: users.dailyBookingLimit,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      });
    return settingsFrom(row);
  }

  private now(): Date {
    const clock = this.options.now;
    if (clock === undefined) {
      return new Date();
    }
    return clock();
  }

  private async owner(sessionId: string | undefined): Promise<CurrentOwner> {
    const user = await this.accounts.currentUser(sessionId);
    if (user.role !== "owner") {
      throw problem(403, "forbidden");
    }
    return user;
  }

  private async ownerId(sessionId: string | undefined): Promise<string> {
    const owner = await this.owner(sessionId);
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, owner.email), eq(users.role, "owner")))
      .limit(1);
    if (row === undefined) {
      throw new Error("Owner is missing");
    }
    return row.id;
  }
}

export { OwnerService };
