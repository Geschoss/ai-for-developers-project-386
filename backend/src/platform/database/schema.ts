import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Пользователи. Роль `owner` — Владелец; роль `admin` — Администратор.
 * Календарь живёт в `calendars` (ADR-0008). Администратор один: его создаёт старт приложения.
 */
const users = pgTable(
  "users",
  {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    email: text("email").notNull(),
    id: uuid("id").primaryKey(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["owner", "admin"] }).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_single_admin")
      .on(table.role)
      .where(sql`${table.role} = 'admin'`),
  ],
);

/** Серверная сессия. Идентификатор — значение cookie `sid`. */
const sessions = pgTable("sessions", {
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/**
 * Календарь Владельца. У Владельца ровно одна строка; у Администратора её нет (ADR-0008).
 * Бронирование блокирует эту строку, а не строку Владельца (ADR-0003).
 */
const calendars = pgTable(
  "calendars",
  {
    dailyBookingLimit: integer("daily_booking_limit").notNull(),
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planningHorizonDays: integer("planning_horizon_days").notNull(),
    slug: text("slug").notNull(),
    timeZone: text("time_zone").notNull(),
  },
  (table) => [
    uniqueIndex("calendars_owner_unique").on(table.ownerId),
    uniqueIndex("calendars_slug_unique").on(table.slug),
  ],
);

/**
 * Бронирование. Уникальный индекс не даёт двум Гостям занять один Слот (ADR-0003).
 * Список Слотов читает только `start_at`: имя и email Гостя наружу не отдаются.
 */
const bookings = pgTable(
  "bookings",
  {
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    guestEmail: text("guest_email").notNull(),
    guestName: text("guest_name").notNull(),
    id: uuid("id").primaryKey(),
    startAt: timestamp("start_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("bookings_calendar_start_unique").on(table.calendarId, table.startAt)],
);

export { bookings, calendars, sessions, users };
