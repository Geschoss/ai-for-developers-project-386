import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import type { components } from "spec/api";

import { CalendarsService } from "./calendars.service.js";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];
type BookingRequest = components["schemas"]["BookingRequest"];
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

  @Post(":calendarSlug/bookings")
  @HttpCode(201)
  public async createBooking(
    @Param("calendarSlug") calendarSlug: string,
    @Body() booking: BookingRequest,
  ): Promise<BookingConfirmation> {
    const confirmation = await this.calendars.createBooking(calendarSlug, booking);
    return confirmation;
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
