import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import * as OpenApiValidator from "express-openapi-validator";

/** A cookie the validator accepts as a session; whether it is valid is the backend's concern. */
export const session = "sid=test-session";

const apiSpec = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

/**
 * The validation layer the backend will mount (ADR-0001), with every valid request answered by a stub 200.
 * Tests use it to check what the contract lets through and what it rejects; 200 means "passed validation".
 */
export function contractApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(OpenApiValidator.middleware({ apiSpec, validateRequests: true, validateResponses: false }));
  app.use((_req, res) => {
    res.status(200).json({ stub: true });
  });
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    res.status(err.status ?? 500).json({ message: err.message, errors: err.errors });
  };
  app.use(onError);
  return app;
}
