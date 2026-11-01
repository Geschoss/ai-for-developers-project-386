import { CALENDAR_REPOSITORY } from "../domain/ports/calendar-repository.js";
import { CLOCK } from "../domain/ports/clock.js";
import {
  CALENDAR_SETTINGS_STORE,
  PUBLIC_CALENDAR_QUERY,
  SLOT_LIST_QUERY,
} from "../domain/ports/read-queries.js";
import { UNIT_OF_WORK } from "../domain/ports/unit-of-work.js";
import { DrizzleCalendarRepository } from "./drizzle-calendar-repository.js";
import { DrizzleCalendarSettings } from "./drizzle-calendar-settings.js";
import { DrizzlePublicCalendarQuery } from "./drizzle-public-calendar-query.js";
import { DrizzleSlotListQuery } from "./drizzle-slot-list-query.js";
import { DrizzleUnitOfWork } from "./drizzle-unit-of-work.js";
import { SystemClock } from "./system-clock.js";

/** Drizzle adapters bound to the Планирование ports. The module is the only importer. */
const adapterProviders = [
  { provide: CALENDAR_REPOSITORY, useClass: DrizzleCalendarRepository },
  { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
  { provide: CLOCK, useClass: SystemClock },
  { provide: PUBLIC_CALENDAR_QUERY, useClass: DrizzlePublicCalendarQuery },
  { provide: SLOT_LIST_QUERY, useClass: DrizzleSlotListQuery },
  { provide: CALENDAR_SETTINGS_STORE, useClass: DrizzleCalendarSettings },
];

export { adapterProviders };
