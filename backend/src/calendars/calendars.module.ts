import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { CalendarsController } from "./calendars.controller.js";
import { CalendarsService } from "./calendars.service.js";

@Module({
  controllers: [CalendarsController],
  imports: [DatabaseModule],
  providers: [CalendarsService],
})
export class CalendarsModule {}
