import request from "supertest";
import { describe, it } from "vitest";
import { contractApp } from "./app.ts";

const app = contractApp();
const session = "sid=test-session";

const settings = { timeZone: "Asia/Yekaterinburg", planningHorizonDays: 14, dailyBookingLimit: 2 };

describe("getOwnerSettings", () => {
  it("requires a session", async () => {
    await request(app).get("/api/owner/settings").expect(401);
  });

  it("passes with a session", async () => {
    await request(app).get("/api/owner/settings").set("Cookie", session).expect(200);
  });
});

describe("updateOwnerSettings", () => {
  it("requires a session", async () => {
    await request(app).put("/api/owner/settings").send(settings).expect(401);
  });

  it.each([
    { planningHorizonDays: 1, dailyBookingLimit: 1 },
    { planningHorizonDays: 60, dailyBookingLimit: 18 },
  ])("accepts boundary values %j", async (bounds) => {
    await request(app)
      .put("/api/owner/settings")
      .set("Cookie", session)
      .send({ ...settings, ...bounds })
      .expect(200);
  });

  it.each([
    { planningHorizonDays: 0 },
    { planningHorizonDays: 61 },
    { planningHorizonDays: 1.5 },
    { dailyBookingLimit: 0 },
    { dailyBookingLimit: 19 },
    { timeZone: "Europe/Moscow; drop table" },
    { timeZone: undefined },
  ])("rejects %j", async (change) => {
    await request(app)
      .put("/api/owner/settings")
      .set("Cookie", session)
      .send({ ...settings, ...change })
      .expect(400);
  });
});
