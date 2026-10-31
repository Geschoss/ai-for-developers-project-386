/**
 * Bookable Слоты on the 09:00–17:30 grid in the Владелец's time zone.
 * `now` is injected so "today" and a Слот that has already started do not depend on the clock.
 * The grid is local time: a DST transition changes the UTC instant of 09:00, not the wall clock.
 */

interface SlotQuery {
  from: Date;
  now: Date;
  planningHorizonDays: number;
  timeZone: string;
  to: Date;
}

interface CivilDate {
  day: number;
  month: number;
  year: number;
}

interface WallClock extends CivilDate {
  hour: number;
  minute: number;
  second: number;
}

// oxlint-disable-next-line eslint/no-magic-numbers -- a Слот is 30 minutes
const slotLengthMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid starts at 09:00
const firstSlotHour = 9;
// oxlint-disable-next-line eslint/no-magic-numbers -- 18 Слотов, the last is 17:30–18:00
const slotsPerDay = 18;
// oxlint-disable-next-line eslint/no-magic-numbers -- minutes in an hour
const minutesPerHour = 60;

const firstSlotMinutes = firstSlotHour * minutesPerHour;

const formatterFor = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });

const readPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const found = parts.find((part) => part.type === type);
  if (found === undefined) {
    throw new Error(`Missing date part ${type}`);
  }
  return Number(found.value);
};

const wallClock = (formatter: Intl.DateTimeFormat, instant: Date): WallClock => {
  const parts = formatter.formatToParts(instant);
  return {
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    minute: readPart(parts, "minute"),
    month: readPart(parts, "month"),
    second: readPart(parts, "second"),
    year: readPart(parts, "year"),
  };
};

/** Milliseconds to add to UTC to get the wall clock. Re-checked once, because DST can move it. */
const offsetMs = (formatter: Intl.DateTimeFormat, instant: Date): number => {
  const clock = wallClock(formatter, instant);
  const wall = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return wall - instant.getTime();
};

interface LocalMinute {
  date: CivilDate;
  hour: number;
  minute: number;
}

const zonedLocalToUtc = (formatter: Intl.DateTimeFormat, local: LocalMinute): Date => {
  const { date, hour, minute } = local;
  const asUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const adjusted = asUtc - offsetMs(formatter, new Date(asUtc));
  return new Date(asUtc - offsetMs(formatter, new Date(adjusted)));
};

const civilFrom = (formatter: Intl.DateTimeFormat, instant: Date): CivilDate => {
  const clock = wallClock(formatter, instant);
  return { day: clock.day, month: clock.month, year: clock.year };
};

const addDays = (date: CivilDate, days: number): CivilDate => {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
};

const slotStart = (formatter: Intl.DateTimeFormat, date: CivilDate, index: number): Date => {
  const minuteOfDay = firstSlotMinutes + index * slotLengthMinutes;
  return zonedLocalToUtc(formatter, {
    date,
    hour: Math.floor(minuteOfDay / minutesPerHour),
    minute: minuteOfDay % minutesPerHour,
  });
};

const lastSlotIndex = slotsPerDay - 1;

const utcMidnight = (date: CivilDate): number => Date.UTC(date.year, date.month - 1, date.day);

/** `date` is on `earliest` or a later civil day. */
const notBefore = (date: CivilDate, earliest: CivilDate): boolean =>
  utcMidnight(date) >= utcMidnight(earliest);

interface HorizonCheck {
  now: Date;
  planningHorizonDays: number;
  start: Date;
  timeZone: string;
}

/**
 * Half-open UTC interval of the civil day that contains `instant` in `timeZone`.
 * The Лимит бронирований counts a day here, so two Слоты on one Владелец day share a limit
 * even when a UTC midnight falls between them.
 */
const civilDayBounds = (instant: Date, timeZone: string): { from: Date; to: Date } => {
  const formatter = formatterFor(timeZone);
  const day = civilFrom(formatter, instant);
  return {
    from: zonedLocalToUtc(formatter, { date: day, hour: 0, minute: 0 }),
    to: zonedLocalToUtc(formatter, { date: addDays(day, 1), hour: 0, minute: 0 }),
  };
};

/**
 * True when `start` falls on today in `timeZone` or on one of the following days, `planningHorizonDays` in all.
 * Today counts. The day after the horizon does not.
 */
const withinPlanningHorizon = (check: HorizonCheck): boolean => {
  const formatter = formatterFor(check.timeZone);
  const today = civilFrom(formatter, check.now);
  const slotDay = civilFrom(formatter, check.start);
  const last = addDays(today, check.planningHorizonDays - 1);
  return notBefore(slotDay, today) && notBefore(last, slotDay);
};

const onOwnerGrid = (minuteOfDay: number): boolean => {
  const lastStart = firstSlotMinutes + lastSlotIndex * slotLengthMinutes;
  if (minuteOfDay < firstSlotMinutes || minuteOfDay > lastStart) {
    return false;
  }
  return (minuteOfDay - firstSlotMinutes) % slotLengthMinutes === 0;
};

/** True when `instant` is exactly 09:00, 09:30, … or 17:30 in `timeZone`. */
const isSlotStart = (instant: Date, timeZone: string): boolean => {
  if (Number.isNaN(instant.getTime()) || instant.getUTCMilliseconds() !== 0) {
    return false;
  }
  const formatter = formatterFor(timeZone);
  const clock = wallClock(formatter, instant);
  const minuteOfDay = clock.hour * minutesPerHour + clock.minute;
  if (clock.second !== 0 || !onOwnerGrid(minuteOfDay)) {
    return false;
  }
  const canonical = zonedLocalToUtc(formatter, {
    date: { day: clock.day, month: clock.month, year: clock.year },
    hour: clock.hour,
    minute: clock.minute,
  });
  return canonical.getTime() === instant.getTime();
};

const offered = (start: Date, query: SlotQuery): boolean => {
  const time = start.getTime();
  return time > query.now.getTime() && time >= query.from.getTime() && time < query.to.getTime();
};

/** Слоты that a Гость can still book: future, inside the horizon, and inside [`from`, `to`). */
const bookableSlots = (query: SlotQuery): Date[] => {
  const formatter = formatterFor(query.timeZone);
  const today = civilFrom(formatter, query.now);
  const starts: Date[] = [];
  for (let dayOffset = 0; dayOffset < query.planningHorizonDays; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    for (let index = 0; index < slotsPerDay; index += 1) {
      const start = slotStart(formatter, date, index);
      if (offered(start, query)) {
        starts.push(start);
      }
    }
  }
  return starts;
};

export { bookableSlots, civilDayBounds, isSlotStart, withinPlanningHorizon };
