const timeZoneNames = Intl.supportedValuesOf("timeZone");

/** The browser's IANA zone when the runtime knows it, otherwise UTC. */
const browserTimeZone = (): string => {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZoneNames.includes(zone)) {
    return zone;
  }
  return "UTC";
};

export { browserTimeZone, timeZoneNames };
