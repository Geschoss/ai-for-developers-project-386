import { Body, Controller, Get, Inject, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { AccountsService } from "../../identity/accounts.service.js";
import { sessionIdFrom } from "../../identity/session-cookie.js";
import { CalendarSettingsService } from "../application/calendar-settings.js";
import { translateScheduling } from "./scheduling-problem.js";

type OwnerSettings = components["schemas"]["OwnerSettings"];

@Controller("owner")
export class CalendarSettingsController {
  public constructor(
    @Inject(CalendarSettingsService) private readonly settings: CalendarSettingsService,
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}

  @Get("settings")
  public async getSettings(@Req() request: Request): Promise<OwnerSettings> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const settings = await translateScheduling(this.settings.get(owner.id));
    return settings;
  }

  @Put("settings")
  public async updateSettings(
    @Body() settings: OwnerSettings,
    @Req() request: Request,
  ): Promise<OwnerSettings> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const saved = await translateScheduling(this.settings.update(owner.id, settings));
    return saved;
  }
}
