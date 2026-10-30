import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { components } from "spec/api";

import { AccountsService } from "../accounts/accounts.service.js";
import { DATABASE, type Database } from "../database/database.module.js";
import { users } from "../database/schema.js";
import { problem } from "../problem.js";
import { assertKnownTimeZone } from "../time-zone.js";

type CurrentOwner = components["schemas"]["CurrentOwner"];
type OwnerSettings = components["schemas"]["OwnerSettings"];

interface SettingsRow {
  dailyBookingLimit: number | null;
  planningHorizonDays: number | null;
  timeZone: string | null;
}

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
 * The Владелец's calendar settings. A change writes only these three columns: existing Бронирования
 * stay, because they are absolute instants, and a smaller Горизонт планирования or Лимит бронирований
 * does not remove them.
 */
@Injectable()
class OwnerService {
  public constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}

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

  private async owner(sessionId: string | undefined): Promise<CurrentOwner> {
    const user = await this.accounts.currentUser(sessionId);
    if (user.role !== "owner") {
      throw problem(403, "forbidden");
    }
    return user;
  }
}

export { OwnerService };
