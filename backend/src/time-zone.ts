import { problem } from "./problem.js";

const knownTimeZones = new Set(Intl.supportedValuesOf("timeZone"));

/** `supportedValuesOf` omits `UTC`, which `Intl` still accepts. GitHub Actions runs in that zone. */
const acceptsTimeZone = (timeZone: string): boolean => {
  try {
    const formatted = new Intl.DateTimeFormat("en", { timeZone }).format();
    return formatted.length > 0;
  } catch {
    return false;
  }
};

/** Unknown IANA zones are `validation_failed`, the same code as a body that breaks the schema. */
const assertKnownTimeZone = (timeZone: string): void => {
  if (knownTimeZones.has(timeZone) || acceptsTimeZone(timeZone)) {
    return;
  }
  throw problem(400, "validation_failed", [
    { message: "Unknown time zone", path: "/body/timeZone" },
  ]);
};

export { assertKnownTimeZone };
