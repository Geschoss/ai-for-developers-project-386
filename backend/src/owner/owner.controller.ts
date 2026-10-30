import { Body, Controller, Get, Inject, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { sessionIdFrom } from "../accounts/session-cookie.js";
import { OwnerService } from "./owner.service.js";

type OwnerSettings = components["schemas"]["OwnerSettings"];

@Controller("owner")
export class OwnerController {
  public constructor(@Inject(OwnerService) private readonly owners: OwnerService) {}

  @Get("settings")
  public async getSettings(@Req() request: Request): Promise<OwnerSettings> {
    const settings = await this.owners.getSettings(sessionIdFrom(request));
    return settings;
  }

  @Put("settings")
  public async updateSettings(
    @Body() settings: OwnerSettings,
    @Req() request: Request,
  ): Promise<OwnerSettings> {
    const saved = await this.owners.updateSettings(sessionIdFrom(request), settings);
    return saved;
  }
}
