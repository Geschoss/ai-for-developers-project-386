import { type DynamicModule, Module } from "@nestjs/common";

import { AccountsModule } from "./accounts/accounts.module.js";
import { APP_OPTIONS, type AppOptions, AppOptionsModule } from "./app-options.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({})
class AppModule {
  public static forRoot(options: AppOptions): DynamicModule {
    const optionsModule: DynamicModule = {
      exports: [APP_OPTIONS],
      global: true,
      module: AppOptionsModule,
      providers: [{ provide: APP_OPTIONS, useValue: options }],
    };
    return {
      controllers: [HealthController],
      imports: [optionsModule, DatabaseModule, AccountsModule],
      module: AppModule,
    };
  }
}

export { AppModule };
