import { Button, Card, Stack, Text, TextInput, Title } from "@mantine/core";
import { type ReactElement, type SubmitEvent, useState } from "react";

import { forget } from "../forget";
import type { FieldErrors } from "../problems";
import {
  type BookingConfirmation,
  type BookingOutcome,
  type GuestDraft,
  bookSlot,
  requestFailed,
} from "./book-slot";
import { FormAlert } from "./FormAlert";
import { type DayGroup, dayKey, dayLabel, slotRange } from "./slot-time";
import { SlotList } from "./SlotList";

const GuestForm = ({
  draft,
  fields,
  onEmail,
  onName,
  onSubmit,
  pending,
}: {
  draft: GuestDraft;
  fields: FieldErrors;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
}): ReactElement => (
  <form onSubmit={onSubmit}>
    <Stack mt="md">
      <TextInput
        label="Имя"
        name="name"
        required
        value={draft.name}
        error={fields.name}
        onChange={(event) => {
          onName(event.currentTarget.value);
        }}
      />
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        value={draft.email}
        error={fields.email}
        onChange={(event) => {
          onEmail(event.currentTarget.value);
        }}
      />
      <Button type="submit" loading={pending}>
        Забронировать
      </Button>
    </Stack>
  </form>
);

const BookedNotice = ({
  confirmation,
  guestTimeZone,
}: {
  confirmation: BookingConfirmation;
  guestTimeZone: string;
}): ReactElement => (
  <Stack>
    <Title order={2}>Вы записаны</Title>
    <Text>{confirmation.ownerName}</Text>
    <Text>{dayLabel(dayKey(confirmation.startAt, guestTimeZone))}</Text>
    <Text>Ваше время: {slotRange(confirmation.startAt, guestTimeZone)}</Text>
    <Text>
      Время владельца ({confirmation.ownerTimeZone}):{" "}
      {slotRange(confirmation.startAt, confirmation.ownerTimeZone)}
    </Text>
  </Stack>
);

const slotIsFree = (group: DayGroup | undefined, slotStart: string | undefined): boolean => {
  if (group === undefined || slotStart === undefined) {
    return false;
  }
  return group.slots.some((slot) => slot.startAt === slotStart && slot.status === "free");
};

interface BookingSink {
  calendarSlug: string;
  draft: GuestDraft;
  onRefresh: () => Promise<void>;
  setConfirmation: (value: BookingConfirmation) => void;
  setFields: (value: FieldErrors) => void;
  setFormError: (value: string | undefined) => void;
  setPending: (value: boolean) => void;
  setSlotStart: (value: string | undefined) => void;
}

const showResult = async (outcome: BookingOutcome, sink: BookingSink): Promise<void> => {
  await sink.onRefresh();
  if (outcome.kind === "booked") {
    sink.setConfirmation(outcome.confirmation);
    return;
  }
  sink.setFields(outcome.fields);
  sink.setFormError(outcome.form);
  if (outcome.taken) {
    sink.setSlotStart(undefined);
  }
};

const runPlace = async (start: string, sink: BookingSink): Promise<void> => {
  sink.setFields({});
  sink.setFormError(undefined);
  try {
    await showResult(await bookSlot(sink.calendarSlug, start, sink.draft), sink);
  } catch {
    sink.setFormError(requestFailed);
  } finally {
    sink.setPending(false);
  }
};

const placeBooking = (
  event: SubmitEvent<HTMLFormElement>,
  start: string | undefined,
  sink: BookingSink,
): void => {
  event.preventDefault();
  if (start === undefined) {
    return;
  }
  sink.setPending(true);
  forget(runPlace(start, sink));
};

const GuestFields = ({
  draft,
  fields,
  onEmail,
  onName,
  onSubmit,
  pending,
  shown,
}: {
  draft: GuestDraft;
  fields: FieldErrors;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
  shown: boolean;
}): ReactElement => {
  if (!shown) {
    return <></>;
  }
  return (
    <GuestForm
      draft={draft}
      fields={fields}
      pending={pending}
      onEmail={onEmail}
      onName={onName}
      onSubmit={onSubmit}
    />
  );
};

interface DayView {
  confirmation: BookingConfirmation | undefined;
  day: string | undefined;
  draft: GuestDraft;
  fields: FieldErrors;
  formError: string | undefined;
  group: DayGroup | undefined;
  guestTimeZone: string;
  onEmail: (value: string) => void;
  ownCalendar: boolean;
  onName: (value: string) => void;
  onSelect: (startAt: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
  slotStart: string | undefined;
}

const DayBody = (props: DayView): ReactElement => {
  if (props.confirmation !== undefined) {
    return <BookedNotice confirmation={props.confirmation} guestTimeZone={props.guestTimeZone} />;
  }
  return (
    <>
      <Text fw={600} mb="sm">
        Статус слотов
      </Text>
      <FormAlert message={props.formError} />
      <SlotList
        day={props.day}
        group={props.group}
        guestTimeZone={props.guestTimeZone}
        slotStart={props.slotStart}
        onSelect={props.onSelect}
      />
      <GuestFields
        draft={props.draft}
        fields={props.fields}
        pending={props.pending}
        shown={slotIsFree(props.group, props.slotStart) && !props.ownCalendar}
        onEmail={props.onEmail}
        onName={props.onName}
        onSubmit={props.onSubmit}
      />
    </>
  );
};

const emptyDraft = (): GuestDraft => ({ email: "", name: "" });

interface PanelProps {
  calendarSlug: string;
  day: string | undefined;
  group: DayGroup | undefined;
  guestTimeZone: string;
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
}

/** The day's Слоты, the name and email form, and the «Вы записаны» screen. */
const BookingPanel = (props: PanelProps): ReactElement => {
  const [slotStart, setSlotStart] = useState<string>();
  const [draft, setDraft] = useState(emptyDraft);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation>();
  const sink: BookingSink = {
    calendarSlug: props.calendarSlug,
    draft,
    onRefresh: props.onRefresh,
    setConfirmation,
    setFields,
    setFormError,
    setPending,
    setSlotStart,
  };

  return (
    <Card withBorder padding="md">
      <DayBody
        confirmation={confirmation}
        day={props.day}
        draft={draft}
        fields={fields}
        formError={formError}
        group={props.group}
        guestTimeZone={props.guestTimeZone}
        ownCalendar={props.ownCalendar}
        pending={pending}
        slotStart={slotStart}
        onEmail={(email) => {
          setDraft({ ...draft, email });
        }}
        onName={(name) => {
          setDraft({ ...draft, name });
        }}
        onSelect={setSlotStart}
        onSubmit={(event) => {
          placeBooking(event, slotStart, sink);
        }}
      />
    </Card>
  );
};

export { BookingPanel };
