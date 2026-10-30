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

const fetchCalendar = (input: RequestInfo | URL): Response => {
  const url = urlOf(input);
  if (url.includes("/api/auth/me")) {
    return problem(401, { code: "unauthenticated", status: 401, title: "Unauthorized" });
  }
  if (url.includes("/slots")) {
    return json(200, listed);
  }
  if (url.includes("/api/calendars/missing-slug")) {
    return problem(404, { code: "calendar_not_found", status: 404, title: "Not Found" });
  }
  if (url.includes("/api/calendars/anna")) {
    return json(200, calendar);
  }
  return problem(404, { code: "not_found", status: 404, title: "Not Found" });
};

const renderAt = (path: string): void => {
  globalThis.history.pushState({}, "", path);
  render(<App />);
};

const resetGuest = (): void => {
  guest.timeZone = "Europe/Moscow";
  listed = slots;
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
