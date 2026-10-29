import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import * as OpenApiValidator from "express-openapi-validator";
import { createRequire } from "node:module";
import type { AppOptions } from "./app-options.js";
import { AppModule } from "./app.module.js";
import { ProblemFilter } from "./problem.filter.js";

const apiSpec = createRequire(import.meta.url).resolve("spec/openapi.yaml");

const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/");

/**
 * Builds the whole app: `/api/*` validated against `spec/openapi.yaml` (ADR-0001), errors as problem+json, and the
 * SPA for every other path. The caller calls `init()` or `listen()`; migrations run then.
 */
export async function createApp(options: AppOptions) {
  // Nest's own body parser would run after the validator, which needs the parsed body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), { bodyParser: false });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ProblemFilter());
  app.use(express.json(), cookieParser());
  app.use(
    OpenApiValidator.middleware({
      apiSpec,
      validateRequests: true,
      validateResponses: false,
      ignorePaths: (path: string) => !isApiPath(path),
    }),
  );
  app.useStaticAssets(options.spaDir);
  app.use(spaFallback(options.spaDir));
  return app;
}

/** Client-side routes: any GET outside `/api` that is not a static file gets `index.html`. */
function spaFallback(spaDir: string): RequestHandler {
  const indexHtml = join(spaDir, "index.html");
  return (req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") && !isApiPath(req.path)) {
      res.sendFile(indexHtml);
    } else {
      next();
    }
  };
}
