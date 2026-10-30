import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const guest = vi.hoisted(() => ({ timeZone: "Europe/Moscow" }));

vi.mock("../time-zones", () => ({
  browserTimeZone: (): string => guest.timeZone,
  timeZoneNames: ["Europe/Moscow", "America/New_York", "UTC"],
}));

const calendar = {
  ownerName: "Анна",
  planningHorizonDays: 14,
  timeZone: "Europe/Moscow",
};

const slots = {
  slots: [
    { startAt: "2026-11-02T06:00:00.000Z", status: "free" },
    { startAt: "2026-11-02T06:30:00.000Z", status: "booked" },
  ],
};

const partialThenFullDay = {
  slots: [
    { startAt: "2026-11-02T12:00:00.000Z", status: "free" },
    { startAt: "2026-11-03T06:00:00.000Z", status: "free" },
  ],
};

const problem = (status: number, body: unknown): Response =>
  Response.json(body, {
    headers: { "content-type": "application/problem+json" },
    status,
  });

const json = (status: number, body: unknown): Response => Response.json(body, { status });

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

let listed = slots;
let booking: "created" | "taken" = "created";

const bothBooked = {
  slots: [
    { startAt: "2026-11-02T06:00:00.000Z", status: "booked" },
    { startAt: "2026-11-02T06:30:00.000Z", status: "booked" },
  ],
};

const confirmation = {
  ownerName: "Анна",
  ownerTimeZone: "Europe/Moscow",
  startAt: "2026-11-02T06:00:00.000Z",
};

const methodOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.method;
  }
  return "GET";
};

const bookingResponse = (): Response => {
  listed = bothBooked;
  if (booking === "taken") {
    return problem(409, { code: "slot_taken", status: 409, title: "Conflict" });
  }
  return json(201, confirmation);
};

const calendarResponse = (url: string): Response => {
  if (url.includes("/api/calendars/missing-slug")) {
    return problem(404, { code: "calendar_not_found", status: 404, title: "Not Found" });
  }
  if (url.includes("/api/calendars/anna")) {
    return json(200, calendar);
  }
  return problem(404, { code: "not_found", status: 404, title: "Not Found" });
};

const fetchCalendar = (input: RequestInfo | URL): Response => {
  const url = urlOf(input);
  if (url.includes("/api/auth/me")) {
    return problem(401, { code: "unauthenticated", status: 401, title: "Unauthorized" });
  }
  if (methodOf(input) === "POST" && url.includes("/bookings")) {
    return bookingResponse();
  }
  if (url.includes("/slots")) {
    return json(200, listed);
  }
  return calendarResponse(url);
};

const renderAt = (path: string): void => {
  globalThis.history.pushState({}, "", path);
  render(<App />);
};

const resetGuest = (): void => {
  guest.timeZone = "Europe/Moscow";
  listed = slots;
  booking = "created";
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const response = await Promise.resolve(fetchCalendar(input));
    return response;
  });
};

describe("public calendar", () => {
  beforeEach(resetGuest);

  it("shows the day and Слот status in the Гость's zone when it matches the Владелец", async () => {
    renderAt("/u/anna");

    expect(
      await screen.findByRole("heading", { name: "Запись на звонок у Анна" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ваш часовой пояс/u)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));

    expect(screen.getByText("09:00–09:30")).toBeInTheDocument();
    expect(screen.getByText("09:30–10:00")).toBeInTheDocument();
    expect(screen.getByText("Свободно")).toBeInTheDocument();
    expect(screen.getByText("Занято")).toBeInTheDocument();
  });

  it("shows the zone banner and shifts Слот time when the zones differ", async () => {
    guest.timeZone = "America/New_York";
    renderAt("/u/anna");

    expect(
      await screen.findByText(
        "Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 09:00.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));

    expect(screen.getByText("01:00–01:30")).toBeInTheDocument();
    expect(screen.getByText("01:30–02:00")).toBeInTheDocument();
    expect(screen.queryByText("09:00–09:30")).not.toBeInTheDocument();
  });
});

describe("the zone banner", () => {
  beforeEach(resetGuest);

  it("moves the banner to the owner time of the day the Гость picked", async () => {
    guest.timeZone = "America/New_York";
    listed = partialThenFullDay;
    renderAt("/u/anna");

    expect(
      await screen.findByText(
        "Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 15:00.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^3 ноября/u }));

    expect(
      screen.getByText("Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 09:00."),
    ).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown Адрес календаря", async () => {
    renderAt("/u/missing-slug");

    expect(await screen.findByRole("heading", { name: "Календарь не найден" })).toBeInTheDocument();
    expect(screen.queryByText(/Ваш часовой пояс/u)).not.toBeInTheDocument();
  });
});

const bookFirstSlot = (time: RegExp): void => {
  fireEvent.click(screen.getByRole("button", { name: time }));
  fireEvent.change(screen.getByLabelText("Имя", { exact: false }), {
    target: { value: "Борис" },
  });
  fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
    target: { value: "boris@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Забронировать" }));
};

const bookedOnTheDay = 2;

describe("booking a Слот", () => {
  beforeEach(resetGuest);

  it("shows «Вы записаны» in both zones and marks the Слот booked", async () => {
    guest.timeZone = "America/New_York";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/01:00–01:30/u);

    expect(await screen.findByRole("heading", { name: "Вы записаны" })).toBeInTheDocument();
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("2 ноября")).toBeInTheDocument();
    expect(screen.getByText("Ваше время: 01:00–01:30")).toBeInTheDocument();
    expect(screen.getByText("Время владельца (Europe/Moscow): 09:00–09:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2 ноября, свободно 0$/u })).toBeInTheDocument();
  });

  it("says the Слот was taken and refreshes the day", async () => {
    booking = "taken";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/09:00–09:30/u);

    expect(await screen.findByText("Этот слот уже занят")).toBeInTheDocument();
    expect(screen.queryByText("Свободно")).not.toBeInTheDocument();
    expect(screen.getAllByText("Занято")).toHaveLength(bookedOnTheDay);
    expect(screen.getByRole("button", { name: /^2 ноября, свободно 0$/u })).toBeInTheDocument();
  });
});
