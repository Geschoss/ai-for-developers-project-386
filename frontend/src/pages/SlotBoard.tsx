import { Alert, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { type ReactElement, useState } from "react";
import type { components } from "spec/api";

import { horizonGuestKeys, withHorizonDays } from "./horizon";
import { monthOfKey, type YearMonth } from "./month-grid";
import { MonthCard } from "./MonthCard";
import { dayKey, dayLabel, type DayGroup, groupByDay, slotRange, zoneBanner } from "./slot-time";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type Slot = components["schemas"]["Slot"];

const statusText = (status: Slot["status"]): string => {
  if (status === "free") {
    return "Свободно";
  }
  return "Занято";
};

const StatusText = ({ status }: { status: Slot["status"] }): ReactElement => {
  const label = statusText(status);
  if (status === "booked") {
    return <Text c="dimmed">{label}</Text>;
  }
  return <Text>{label}</Text>;
};

const ZoneAlert = ({ banner }: { banner: string | undefined }): ReactElement => {
  if (banner === undefined) {
    return <></>;
  }
  return <Alert>{banner}</Alert>;
};

const firstStart = (slots: readonly Slot[]): string | undefined => {
  const [first] = slots;
  if (first === undefined) {
    return undefined;
  }
  return first.startAt;
};

const openingMonth = (slots: readonly Slot[], guestTimeZone: string): YearMonth => {
  const start = firstStart(slots);
  if (start === undefined) {
    return monthOfKey(dayKey(new Date().toISOString(), guestTimeZone));
  }
  return monthOfKey(dayKey(start, guestTimeZone));
};

const groupFor = (
  groups: Map<string, DayGroup>,
  selected: string | undefined,
): DayGroup | undefined => {
  if (selected === undefined) {
    return undefined;
  }
  return groups.get(selected);
};

const monthBounds = (
  groups: Map<string, DayGroup>,
  fallback: YearMonth,
): { earliest: YearMonth; latest: YearMonth } => {
  const keys = [...groups.keys()].toSorted();
  const [first] = keys;
  const [last] = keys.slice(-1);
  if (first === undefined || last === undefined) {
    return { earliest: fallback, latest: fallback };
  }
  return { earliest: monthOfKey(first), latest: monthOfKey(last) };
};

interface BoardDays {
  bounds: { earliest: YearMonth; latest: YearMonth };
  groups: Map<string, DayGroup>;
  opened: YearMonth;
}

const boardDays = (
  calendar: PublicCalendar,
  guestTimeZone: string,
  slots: readonly Slot[],
): BoardDays => {
  const groups = withHorizonDays(
    groupByDay(slots, guestTimeZone),
    horizonGuestKeys({
      guestTimeZone,
      now: new Date(),
      ownerTimeZone: calendar.timeZone,
      planningHorizonDays: calendar.planningHorizonDays,
    }),
  );
  const opened = openingMonth(slots, guestTimeZone);
  return { bounds: monthBounds(groups, opened), groups, opened };
};

const bannerSample = (
  groups: Map<string, DayGroup>,
  selected: string | undefined,
  slots: readonly Slot[],
): string | undefined => {
  const group = groupFor(groups, selected);
  if (group !== undefined) {
    const chosen = firstStart(group.slots);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  return firstStart(slots);
};

const SlotList = ({
  group,
  guestTimeZone,
  selected,
}: {
  group: DayGroup | undefined;
  guestTimeZone: string;
  selected: string | undefined;
}): ReactElement => {
  if (selected === undefined || group === undefined) {
    return <Text c="dimmed">Выберите дату в календаре.</Text>;
  }
  return (
    <Stack gap="xs">
      <Text>{dayLabel(selected)}</Text>
      {group.slots.map((slot) => (
        <Group key={slot.startAt} justify="space-between">
          <Text>{slotRange(slot.startAt, guestTimeZone)}</Text>
          <StatusText status={slot.status} />
        </Group>
      ))}
    </Stack>
  );
};

/** Month of bookable days and the Слоты of the day the Гость picked. Booking itself is a later task. */
const SlotBoard = ({
  calendar,
  guestTimeZone,
  slots,
}: {
  calendar: PublicCalendar;
  guestTimeZone: string;
  slots: readonly Slot[];
}): ReactElement => {
  const { bounds, groups, opened } = boardDays(calendar, guestTimeZone, slots);
  const [month, setMonth] = useState(opened);
  const [selected, setSelected] = useState<string>();
  const banner = zoneBanner({
    guestTimeZone,
    now: new Date(),
    ownerTimeZone: calendar.timeZone,
    sampleStart: bannerSample(groups, selected, slots),
  });

  return (
    <Stack gap="md">
      <Title order={1}>Запись на звонок у {calendar.ownerName}</Title>
      <ZoneAlert banner={banner} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <MonthCard
          earliest={bounds.earliest}
          groups={groups}
          latest={bounds.latest}
          month={month}
          onMonth={setMonth}
          onSelect={setSelected}
          selected={selected}
        />
        <Card withBorder padding="md">
          <Text fw={600} mb="sm">
            Статус слотов
          </Text>
          <SlotList
            group={groupFor(groups, selected)}
            guestTimeZone={guestTimeZone}
            selected={selected}
          />
        </Card>
      </SimpleGrid>
    </Stack>
  );
};

export { SlotBoard };
