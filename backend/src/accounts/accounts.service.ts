import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../database/database.module.js";
import { sessions, users } from "../database/schema.js";
import { problem } from "../problem.js";
import { assertKnownTimeZone } from "../time-zone.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { sessionExpiresAt } from "./session-cookie.js";

type Credentials = components["schemas"]["Credentials"];
type CurrentOwner = components["schemas"]["CurrentOwner"];
type CurrentUser = components["schemas"]["CurrentUser"];
type OwnerRegistration = components["schemas"]["OwnerRegistration"];

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new owner gets a planning horizon of 14
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new owner gets a daily booking limit of 2
const defaultDailyBookingLimit = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const conflictCode = (error: unknown): "email_taken" | "slug_taken" | undefined => {
  if (!isRecord(error) || !isRecord(error["cause"]) || error["cause"]["code"] !== "23505") {
    return undefined;
  }
  if (error["cause"]["constraint"] === "users_email_unique") {
    return "email_taken";
  }
  if (error["cause"]["constraint"] === "users_calendar_slug_unique") {
    return "slug_taken";
  }
  return undefined;
};

const rethrowConflict = (error: unknown): void => {
  const code = conflictCode(error);
  if (code !== undefined) {
    throw problem(409, code);
  }
  throw error;
};

const hashToCheck = async (
  user: { passwordHash: string } | undefined,
  dummyHash: Promise<string>,
): Promise<string> => {
  if (user === undefined) {
    const hash = await dummyHash;
    return hash;
  }
  return user.passwordHash;
};

interface StartedSession {
  sessionId: string;
  user: CurrentOwner;
}

interface UserRow {
  calendarSlug: string | null;
  email: string;
  name: string | null;
  role: "admin" | "owner";
  timeZone: string | null;
}

const currentUserFrom = (user: UserRow): CurrentUser => {
  if (user.role === "admin") {
    return { email: user.email, role: "admin" };
  }
  if (user.name === null || user.calendarSlug === null || user.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    calendarSlug: user.calendarSlug,
    email: user.email,
    name: user.name,
    role: "owner",
    timeZone: user.timeZone,
  };
};

/** Registration, login, logout and the current user. Sessions live in `sessions`. */
@Injectable()
class AccountsService {
  /** Verified when the email is unknown, so login does not answer faster for a missing account. */
  private readonly dummyHash: Promise<string> = hashPassword(randomUUID());

  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Creates an owner and a session. Email is stored in lowercase; the calendar slug is unique. */
  public async register(registration: OwnerRegistration): Promise<StartedSession> {
    assertKnownTimeZone(registration.timeZone);
    const email = registration.email.toLowerCase();
    await this.rejectTaken(email, registration.calendarSlug);
    const userId = randomUUID();
    const sessionId = randomUUID();
    try {
      await this.storeOwner({ email, registration, sessionId, userId });
    } catch (error) {
      rethrowConflict(error);
    }
    return {
      sessionId,
      user: {
        calendarSlug: registration.calendarSlug,
        email,
        name: registration.name,
        role: "owner",
        timeZone: registration.timeZone,
      },
    };
  }

  /** Opens a session for an owner or an administrator. The error does not say which part was wrong. */
  public async logIn(credentials: Credentials): Promise<{ sessionId: string; user: CurrentUser }> {
    const email = credentials.email.toLowerCase();
    const [user] = await this.db
      .select({
        calendarSlug: users.calendarSlug,
        email: users.email,
        id: users.id,
        name: users.name,
        passwordHash: users.passwordHash,
        role: users.role,
        timeZone: users.timeZone,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    const passwordHash = await hashToCheck(user, this.dummyHash);
    const matches = await verifyPassword(passwordHash, credentials.password);
    if (user === undefined || !matches) {
      throw problem(401, "invalid_credentials");
    }
    const sessionId = randomUUID();
    await this.db.insert(sessions).values({
      expiresAt: sessionExpiresAt(),
      id: sessionId,
      userId: user.id,
    });
    return { sessionId, user: currentUserFrom(user) };
  }

  /** Deletes the session when there is one. Missing and unknown cookies are not an error. */
  public async logOut(sessionId: string | undefined): Promise<void> {
    if (sessionId === undefined) {
      return;
    }
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /** The user behind `sid`, or `unauthenticated` when the session is missing or expired. */
  public async currentUser(sessionId: string | undefined): Promise<CurrentUser> {
    if (sessionId === undefined) {
      throw problem(401, "unauthenticated");
    }
    const [row] = await this.db
      .select({
        calendarSlug: users.calendarSlug,
        email: users.email,
        expiresAt: sessions.expiresAt,
        name: users.name,
        role: users.role,
        timeZone: users.timeZone,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (row === undefined || row.expiresAt.getTime() <= Date.now()) {
      if (row !== undefined) {
        await this.db.delete(sessions).where(eq(sessions.id, sessionId));
      }
      throw problem(401, "unauthenticated");
    }
    return currentUserFrom(row);
  }

  private async storeOwner(input: {
    email: string;
    registration: OwnerRegistration;
    sessionId: string;
    userId: string;
  }): Promise<void> {
    const passwordHash = await hashPassword(input.registration.password);
    await this.db.transaction(async (tx) => {
      await tx.insert(users).values({
        calendarSlug: input.registration.calendarSlug,
        dailyBookingLimit: defaultDailyBookingLimit,
        email: input.email,
        id: input.userId,
        name: input.registration.name,
        passwordHash,
        planningHorizonDays: defaultPlanningHorizonDays,
        role: "owner",
        timeZone: input.registration.timeZone,
      });
      await tx.insert(sessions).values({
        expiresAt: sessionExpiresAt(),
        id: input.sessionId,
        userId: input.userId,
      });
    });
  }

  /** Email wins when both are taken, so the form can point at one field. */
  private async rejectTaken(email: string, calendarSlug: string): Promise<void> {
    const [byEmail] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (byEmail !== undefined) {
      throw problem(409, "email_taken");
    }
    const [bySlug] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.calendarSlug, calendarSlug))
      .limit(1);
    if (bySlug !== undefined) {
      throw problem(409, "slug_taken");
    }
  }
}

export { AccountsService };
