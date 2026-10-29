import { type DynamicModule, Module } from "@nestjs/common";
import { APP_OPTIONS, type AppOptions } from "./app-options.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({})
export class AppModule {
  static forRoot(options: AppOptions): DynamicModule {
    const optionsModule: DynamicModule = {
      module: class AppOptionsModule {},
      global: true,
      providers: [{ provide: APP_OPTIONS, useValue: options }],
      exports: [APP_OPTIONS],
    };
    return { module: AppModule, imports: [optionsModule, DatabaseModule], controllers: [HealthController] };
  }
}
