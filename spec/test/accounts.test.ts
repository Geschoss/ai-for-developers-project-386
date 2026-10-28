import request from "supertest";
import { describe, expect, it } from "vitest";
import { contractApp } from "./app.ts";

const app = contractApp();

const registration = {
  name: "Анна",
  email: "anna@example.com",
  password: "long-enough",
  calendarSlug: "anna-01",
  timeZone: "Europe/Moscow",
};

describe("registerOwner", () => {
  it("accepts a valid registration", async () => {
    await request(app).post("/api/auth/register").send(registration).expect(200);
  });

  it.each(["ab", "a".repeat(31), "Anna", "anna_01", "анна"])("rejects calendar slug %j", async (calendarSlug) => {
    await request(app)
      .post("/api/auth/register")
      .send({ ...registration, calendarSlug })
      .expect(400);
  });
});
