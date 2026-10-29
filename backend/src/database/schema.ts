import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Пользователи. Роль `owner` — Владелец с календарём; роль `admin` — Администратор без календаря.
 * Администратор один: его создаёт старт приложения, регистрация его не создаёт.
 */
const users = pgTable(
  "users",
  {
    calendarSlug: text("calendar_slug"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    dailyBookingLimit: integer("daily_booking_limit"),
    email: text("email").notNull(),
    id: uuid("id").primaryKey(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    planningHorizonDays: integer("planning_horizon_days"),
    role: text("role", { enum: ["owner", "admin"] }).notNull(),
    timeZone: text("time_zone"),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_calendar_slug_unique").on(table.calendarSlug),
    uniqueIndex("users_single_admin")
      .on(table.role)
      .where(sql`${table.role} = 'admin'`),
    check(
      "users_role_shape",
      sql`(
        ${table.role} = 'owner'
        AND ${table.name} IS NOT NULL
        AND ${table.calendarSlug} IS NOT NULL
        AND ${table.timeZone} IS NOT NULL
        AND ${table.planningHorizonDays} IS NOT NULL
        AND ${table.dailyBookingLimit} IS NOT NULL
      ) OR (
        ${table.role} = 'admin'
        AND ${table.name} IS NULL
        AND ${table.calendarSlug} IS NULL
        AND ${table.timeZone} IS NULL
        AND ${table.planningHorizonDays} IS NULL
        AND ${table.dailyBookingLimit} IS NULL
      )`,
    ),
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

export { sessions, users };
