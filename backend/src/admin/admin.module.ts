import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminSeed } from "./admin-seed.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  controllers: [AdminController],
  imports: [AccountsModule, DatabaseModule],
  providers: [AdminSeed, AdminService],
})
export class AdminModule {}
