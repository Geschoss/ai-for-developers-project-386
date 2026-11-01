import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { BookSlot } from "./application/book-slot.js";
import { CalendarSettingsService } from "./application/calendar-settings.js";
import { GetPublicCalendar } from "./application/get-public-calendar.js";
import { ListSlots } from "./application/list-slots.js";
import { calendarRoutesProvider } from "./http/calendar-routes-provider.js";
import { CalendarSettingsController, CalendarsController } from "./http/controllers.js";
import { adapterProviders } from "./infrastructure/adapter-providers.js";

@Module({
  controllers: [CalendarsController, CalendarSettingsController],
  imports: [AccountsModule, DatabaseModule],
  providers: [
    BookSlot,
    ListSlots,
    GetPublicCalendar,
    CalendarSettingsService,
    ...adapterProviders,
    calendarRoutesProvider,
  ],
})
export class SchedulingModule {}
