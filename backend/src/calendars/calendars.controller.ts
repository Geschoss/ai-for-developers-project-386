import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import type { components } from "spec/api";

import { CalendarsService } from "./calendars.service.js";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type SlotList = components["schemas"]["SlotList"];

@Controller("calendars")
export class CalendarsController {
  public constructor(@Inject(CalendarsService) private readonly calendars: CalendarsService) {}

  @Get(":calendarSlug")
  public async getPublic(@Param("calendarSlug") calendarSlug: string): Promise<PublicCalendar> {
    const calendar = await this.calendars.getPublic(calendarSlug);
    return calendar;
  }

  @Get(":calendarSlug/slots")
  public async listSlots(
    @Param("calendarSlug") calendarSlug: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<SlotList> {
    const slots = await this.calendars.listSlots(calendarSlug, new Date(from), new Date(to));
    return slots;
  }
}
