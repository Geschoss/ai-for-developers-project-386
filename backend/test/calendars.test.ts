import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a horizon of 14 days
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid starts at 09:00
const firstSlotHour = 9;
// oxlint-disable-next-line eslint/no-magic-numbers -- the last Слот starts at 17:30
const lastSlotHour = 17;
// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- minutes in an hour
const minutesPerHour = 60;

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const guestName = "Секретное имя";
const guestEmail = "secret-guest@example.com";

interface Slot {
  startAt: string;
  status: string;
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;
let databaseUrl = "";

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
};

let sequence = 0;

const registerOwner = async (timeZone = "Europe/Moscow"): Promise<string> => {
  sequence += 1;
  const slug = `guest-${sequence}`;
  await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone,
    })
    .expect(201);
  return slug;
};

const readCalendar = async (slug: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp())).get(`/api/calendars/${slug}`);
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}");
  return response;
};

const listSlots = async (
  slug: string,
  query: { from: string; to: string } = wideRange,
): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${slug}/slots`)
    .query(query);
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}/slots");
  return response;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSlot = (value: unknown): value is Slot => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value["startAt"] === "string" && typeof value["status"] === "string";
};

const slotsOf = (response: request.Response): Slot[] => {
  const body: unknown = response.body;
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isSlot)) {
    throw new Error("slots response is not a SlotList");
  }
  return body["slots"];
};

const minuteOfDay = (startAt: string, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(new Date(startAt));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (found === undefined) {
      throw new Error(`Missing ${type}`);
    }
    return Number(found.value);
  };
  return read("hour") * minutesPerHour + read("minute");
};

const onOwnerGrid = (startAt: string): boolean => {
  const minute = minuteOfDay(startAt, "Europe/Moscow");
  const lastStart = lastSlotHour * minutesPerHour + slotLengthMinutes;
  return (
    minute >= firstSlotHour * minutesPerHour &&
    minute <= lastStart &&
    minute % slotLengthMinutes === 0
  );
};

const expectBookable = (slots: Slot[], before: number): void => {
  const starts = slots.map((slot) => slot.startAt);
  expect(slots.length).toBeGreaterThan(0);
  expect(slots.every((slot) => slot.status === "free")).toBe(true);
  expect(slots.every((slot) => onOwnerGrid(slot.startAt))).toBe(true);
  expect(slots.every((slot) => new Date(slot.startAt).getTime() > before)).toBe(true);
  expect(starts.toSorted()).toEqual(starts);
  expect(JSON.stringify(slots)).not.toContain("@");
};

const bookedSlots = (slots: Slot[]): Slot[] => slots.filter((slot) => slot.status === "booked");

const furthestSlot = (slots: Slot[]): Slot => {
  const [slot] = slots.slice(-1);
  if (slot === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  return slot;
};

const expectHiddenGuest = (response: request.Response, startAt: string): void => {
  const body = JSON.stringify(response.body);
  expect(bookedSlots(slotsOf(response))).toEqual([{ startAt, status: "booked" }]);
  expect(body).not.toContain(guestName);
  expect(body).not.toContain(guestEmail);
};

const insertBooking = async (slug: string, startAt: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const inserted = await client.query(
      `insert into bookings (id, owner_id, guest_name, guest_email, start_at)
       select $1, id, $2, $3, $4 from users where calendar_slug = $5`,
      [randomUUID(), guestName, guestEmail, startAt, slug],
    );
    expect(inserted.rowCount).toBe(1);
  } finally {
    await client.end();
  }
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  databaseUrl = database.getConnectionUri();
  app = await createApp(testAppOptions(databaseUrl));
  await app.init();
});

afterAll(async () => {
  if (app !== undefined) {
    await app.close();
  }
  if (database !== undefined) {
    await database.stop();
  }
});

describe("GET /api/calendars/:slug", () => {
  it("returns the public calendar and no account data", async () => {
    const slug = await registerOwner();
    const response = await readCalendar(slug);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ownerName: "Анна",
      planningHorizonDays: defaultPlanningHorizonDays,
      timeZone: "Europe/Moscow",
    });
    expect(JSON.stringify(response.body)).not.toContain("@");
  });

  it("answers calendar_not_found for an unknown Адрес календаря", async () => {
    const response = await readCalendar("missing-owner");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "calendar_not_found" });
  });
});

describe("GET /api/calendars/:slug/slots", () => {
  it("lists future Слоты on the owner's grid and nothing about a Гость", async () => {
    const slug = await registerOwner();
    const before = Date.now();
    const response = await listSlots(slug);

    expect(response.status).toBe(200);
    expectBookable(slotsOf(response), before);
  });

  it("marks a stored Бронирование as booked without the Гость's name or email", async () => {
    const slug = await registerOwner();
    const furthest = furthestSlot(slotsOf(await listSlots(slug)));
    await insertBooking(slug, furthest.startAt);
    const response = await listSlots(slug);

    expectHiddenGuest(response, furthest.startAt);
  });

  it("returns no Слоты when the window is empty", async () => {
    const slug = await registerOwner();
    const response = await listSlots(slug, {
      from: "2026-12-02T00:00:00.000Z",
      to: "2026-12-01T00:00:00.000Z",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ slots: [] });
  });

  it("answers calendar_not_found for an unknown Адрес календаря", async () => {
    const response = await listSlots("missing-owner");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "calendar_not_found" });
  });
});
