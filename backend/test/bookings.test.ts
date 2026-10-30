import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
const guestName = "Борис";
const raceEmails = ["a@example.com", "b@example.com", "c@example.com", "d@example.com"];

interface Slot {
  startAt: string;
  status: string;
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;

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

const registerOwner = async (): Promise<string> => {
  sequence += 1;
  const slug = `book-${sequence}`;
  await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: "Europe/Moscow",
    })
    .expect(201);
  return slug;
};

const listSlots = async (slug: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${slug}/slots`)
    .query(wideRange);
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

const furthestSlot = (slots: Slot[]): Slot => {
  const [slot] = slots.slice(-1);
  if (slot === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  return slot;
};

const bookedSlots = (slots: Slot[]): Slot[] => slots.filter((slot) => slot.status === "booked");

const book = async (slug: string, startAt: string, email: string): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${slug}/bookings`)
    .send({ guest: { email, name: guestName }, startAt });
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  return response;
};

const problemCode = (response: request.Response): string | undefined => {
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return body["code"];
};

const withStatus = (responses: request.Response[], status: number): request.Response[] =>
  responses.filter((response) => response.status === status);

const hiddenGuest = (response: request.Response, startAt: string): void => {
  const body = JSON.stringify(response.body);
  expect(bookedSlots(slotsOf(response))).toEqual([{ startAt, status: "booked" }]);
  expect(body).not.toContain(guestName);
  expect(body).not.toContain("boris@example.com");
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri()));
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

describe("POST /api/calendars/:slug/bookings", () => {
  it("books a free Слот and then shows it as booked, without the Гость", async () => {
    const slug = await registerOwner();
    const slot = furthestSlot(slotsOf(await listSlots(slug)));
    const response = await book(slug, slot.startAt, "boris@example.com");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ownerName: "Анна",
      ownerTimeZone: "Europe/Moscow",
      startAt: slot.startAt,
    });
    hiddenGuest(await listSlots(slug), slot.startAt);
  });

  it.each([
    "2026-11-02T05:00:00.000Z",
    "2026-11-02T06:15:00.000Z",
    "2026-11-02T06:00:01.000Z",
    "2026-11-02T15:00:00.000Z",
  ])("rejects %s: it is not a start on the owner's grid", async (startAt) => {
    const slug = await registerOwner();
    const response = await book(slug, startAt, "off-grid@example.com");

    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe("not_a_slot_start");
  });

  it("gives one Слот to exactly one of several simultaneous Гости", async () => {
    const slug = await registerOwner();
    const slot = furthestSlot(slotsOf(await listSlots(slug)));
    const responses = await Promise.all(
      raceEmails.map(async (email) => {
        const response = await book(slug, slot.startAt, email);
        return response;
      }),
    );
    const created = withStatus(responses, 201);
    const taken = withStatus(responses, 409);

    expect(created).toHaveLength(1);
    expect(taken).toHaveLength(raceEmails.length - 1);
    expect(taken.every((response) => problemCode(response) === "slot_taken")).toBe(true);
    hiddenGuest(await listSlots(slug), slot.startAt);
  });
});
