import { Module } from "@nestjs/common";

import { DatabaseModule } from "../platform/database/database.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsService } from "./accounts.service.js";
import { AdminSeed } from "./admin-seed.js";

@Module({
  controllers: [AccountsController],
  exports: [AccountsService],
  imports: [DatabaseModule],
  providers: [AccountsService, AdminSeed],
})
export class AccountsModule {}
