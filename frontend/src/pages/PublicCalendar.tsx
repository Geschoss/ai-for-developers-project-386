import { Alert, Center, Container, Loader, Title } from "@mantine/core";
import { type ReactElement, useEffect, useState } from "react";
import { useParams } from "react-router";
import type { components } from "spec/api";

import { api } from "../api";
import { forget } from "../forget";
import { useSession } from "../session";
import { browserTimeZone } from "../time-zones";
import { SlotBoard } from "./SlotBoard";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type Slot = components["schemas"]["Slot"];

const rangeFrom = "2020-01-01T00:00:00.000Z";
const rangeTo = "2040-01-01T00:00:00.000Z";

type LoadState =
  | { calendar: PublicCalendar; kind: "ready"; slots: Slot[] }
  | { kind: "failed" }
  | { kind: "loading" }
  | { kind: "missing" };

const readCalendar = async (
  calendarSlug: string,
): Promise<PublicCalendar | "failed" | "missing"> => {
  const calendar = await api.GET("/api/calendars/{calendarSlug}", {
    params: { path: { calendarSlug } },
  });
  if (calendar.response.status === 404) {
    return "missing";
  }
  if (calendar.data === undefined) {
    return "failed";
  }
  return calendar.data;
};

const readSlots = async (calendarSlug: string): Promise<Slot[] | undefined> => {
  const listed = await api.GET("/api/calendars/{calendarSlug}/slots", {
    params: { path: { calendarSlug }, query: { from: rangeFrom, to: rangeTo } },
  });
  if (listed.data === undefined) {
    return undefined;
  }
  return listed.data.slots;
};

const loadedCalendar = async (calendarSlug: string): Promise<LoadState> => {
  const calendar = await readCalendar(calendarSlug);
  if (calendar === "missing" || calendar === "failed") {
    return { kind: calendar };
  }
  const slots = await readSlots(calendarSlug);
  if (slots === undefined) {
    return { kind: "failed" };
  }
  return { calendar, kind: "ready", slots };
};

const loadCalendar = async (calendarSlug: string): Promise<LoadState> => {
  try {
    return await loadedCalendar(calendarSlug);
  } catch {
    return { kind: "failed" };
  }
};

const MissingCalendar = (): ReactElement => (
  <Container size="xs" py={64}>
    <Title order={1}>Календарь не найден</Title>
  </Container>
);

const CalendarBody = ({
  onRefresh,
  ownCalendar,
  slug,
  state,
}: {
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
  slug: string;
  state: LoadState;
}): ReactElement => {
  if (state.kind === "loading") {
    return (
      <Center h="40vh">
        <Loader />
      </Center>
    );
  }
  if (state.kind === "missing") {
    return <MissingCalendar />;
  }
  if (state.kind === "failed") {
    return (
      <Container size="xs" py={64}>
        <Alert color="red">Не удалось загрузить календарь</Alert>
      </Container>
    );
  }
  return (
    <Container size="lg" py="lg">
      <SlotBoard
        calendar={state.calendar}
        calendarSlug={slug}
        guestTimeZone={browserTimeZone()}
        onRefresh={onRefresh}
        ownCalendar={ownCalendar}
        slots={state.slots}
      />
    </Container>
  );
};

/** `/u/:calendarSlug`. A Гость picks a free Слот, leaves a name and email, and sees «Вы записаны». */
const PublicCalendarPage = (): ReactElement => {
  const { calendarSlug } = useParams();
  const { user } = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const ownCalendar =
    user !== undefined && user.role === "owner" && user.calendarSlug === calendarSlug;

  useEffect(() => {
    if (calendarSlug === undefined) {
      return;
    }
    const load = async (): Promise<void> => {
      setState(await loadCalendar(calendarSlug));
    };
    forget(load());
  }, [calendarSlug]);

  const reload = async (): Promise<void> => {
    if (calendarSlug === undefined) {
      return;
    }
    const slots = await readSlots(calendarSlug);
    if (slots === undefined) {
      return;
    }
    setState((current) => {
      if (current.kind !== "ready") {
        return current;
      }
      return { ...current, slots };
    });
  };

  if (calendarSlug === undefined) {
    return <MissingCalendar />;
  }
  return (
    <CalendarBody onRefresh={reload} ownCalendar={ownCalendar} slug={calendarSlug} state={state} />
  );
};

export { PublicCalendarPage };
