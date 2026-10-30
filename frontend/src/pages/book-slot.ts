import type { components } from "spec/api";

import { api } from "../api";
import { errorsFor, type FieldErrors } from "../problems";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];

interface GuestDraft {
  email: string;
  name: string;
}

type BookingOutcome =
  | { confirmation: BookingConfirmation; kind: "booked" }
  | { fields: FieldErrors; form: string | undefined; kind: "rejected"; taken: boolean };

const requestFailed = "Не удалось выполнить запрос";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSlotTaken = (error: unknown): boolean => isRecord(error) && error["code"] === "slot_taken";

const bookSlot = async (
  calendarSlug: string,
  startAt: string,
  guest: GuestDraft,
): Promise<BookingOutcome> => {
  const result = await api.POST("/api/calendars/{calendarSlug}/bookings", {
    body: { guest, startAt },
    params: { path: { calendarSlug } },
  });
  if (result.data !== undefined) {
    return { confirmation: result.data, kind: "booked" };
  }
  const shown = errorsFor(result.error);
  return {
    fields: shown.fields,
    form: shown.form,
    kind: "rejected",
    taken: isSlotTaken(result.error),
  };
};

export { type BookingConfirmation, type BookingOutcome, type GuestDraft, bookSlot, requestFailed };
