import type { TimeZone } from "../../shared-kernel/time-zone.js";
import { isSlotStart } from "./slot-grid.js";

/** An instant that is exactly 09:00, 09:30, … or 17:30 in the Календарь's zone. */
class SlotStart {
  private constructor(public readonly instant: Date) {}

  public static onGrid(instant: Date, timeZone: TimeZone): SlotStart | undefined {
    if (!isSlotStart(instant, timeZone.name)) {
      return undefined;
    }
    return new SlotStart(instant);
  }
}

export { SlotStart };
