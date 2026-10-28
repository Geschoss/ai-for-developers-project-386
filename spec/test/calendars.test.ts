import request from "supertest";
import { describe, it } from "vitest";
import { contractApp } from "./app.ts";

const app = contractApp();

describe("getPublicCalendar", () => {
  it("is public", async () => {
    await request(app).get("/api/calendars/anna-01").expect(200);
  });

  it("rejects a malformed calendar slug", async () => {
    await request(app).get("/api/calendars/Anna_01").expect(400);
  });
});

describe("listSlots", () => {
  const range = { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" };

  it("is public", async () => {
    await request(app).get("/api/calendars/anna-01/slots").query(range).expect(200);
  });

  it.each([{ from: range.from }, { to: range.to }, { from: "2026-11-01", to: "2026-12-01" }])(
    "rejects range %j",
    async (query) => {
      await request(app).get("/api/calendars/anna-01/slots").query(query).expect(400);
    },
  );
});

describe("createBooking", () => {
  const booking = { startAt: "2026-11-02T06:00:00Z", guest: { name: "Борис", email: "boris@example.com" } };

  it("needs no session", async () => {
    await request(app).post("/api/calendars/anna-01/bookings").send(booking).expect(200);
  });

  it("also passes with a session, so the server can detect own_calendar", async () => {
    await request(app)
      .post("/api/calendars/anna-01/bookings")
      .set("Cookie", "sid=test-session")
      .send(booking)
      .expect(200);
  });

  it.each([
    { ...booking, startAt: "2026-11-02 09:00" },
    { ...booking, guest: { ...booking.guest, email: "not-an-email" } },
    { ...booking, guest: { ...booking.guest, name: "" } },
    { startAt: booking.startAt },
  ])("rejects %j", async (body) => {
    await request(app).post("/api/calendars/anna-01/bookings").send(body).expect(400);
  });
});
