import { problem } from "../problem.js";
import { TimeZone } from "../shared-kernel/time-zone.js";
import { UnknownTimeZoneError } from "../shared-kernel/unknown-time-zone-error.js";

/** Unknown IANA zones are `validation_failed`, the same code as a body that breaks the schema. */
const knownTimeZone = (timeZone: string): void => {
  try {
    TimeZone.parse(timeZone);
  } catch (error) {
    if (error instanceof UnknownTimeZoneError) {
      throw problem(400, "validation_failed", [
        { message: "Unknown time zone", path: "/body/timeZone" },
      ]);
    }
    throw error;
  }
};

export { knownTimeZone };
