import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { users } from "../../platform/database/schema.js";
import type { CalendarSettings, CalendarSettingsStore } from "../domain/ports/read-queries.js";

interface SettingsRow {
  dailyBookingLimit: number | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

const settingsFrom = (row: SettingsRow | undefined): CalendarSettings => {
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

/** Reads and replaces the three settings columns. Does not touch Бронирования. */
@Injectable()
class DrizzleCalendarSettings implements CalendarSettingsStore {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async get(ownerId: string): Promise<CalendarSettings> {
    const [row] = await this.db
      .select({
        dailyBookingLimit: users.dailyBookingLimit,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(and(eq(users.id, ownerId), eq(users.role, "owner")))
      .limit(1);
    return settingsFrom(row);
  }

  public async save(ownerId: string, settings: CalendarSettings): Promise<CalendarSettings> {
    const [row] = await this.db
      .update(users)
      .set({
        dailyBookingLimit: settings.dailyBookingLimit,
        planningHorizonDays: settings.planningHorizonDays,
        timeZone: settings.timeZone,
      })
      .where(and(eq(users.id, ownerId), eq(users.role, "owner")))
      .returning({
        dailyBookingLimit: users.dailyBookingLimit,
        planningHorizonDays: users.planningHorizonDays,
        timeZone: users.timeZone,
      });
    return settingsFrom(row);
  }
}

export { DrizzleCalendarSettings };
