import { STATUS_CODES } from "node:http";
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Response } from "express";
import type { components } from "spec/api";

type ValidationIssue = components["schemas"]["ValidationIssue"];

/** Codes for errors that no feature raises itself: framework 404s, validator rejections, crashes. */
const codeByStatus: Record<number, string> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  415: "unsupported_media_type",
};

/** Renders every error as RFC 9457 `application/problem+json` with a machine-readable `code`. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const status = statusOf(exception);
    if (status >= 500) {
      this.logger.error(exception);
    }
    const problem: Record<string, unknown> = {
      code: codeByStatus[status] ?? "internal_error",
      status,
      title: STATUS_CODES[status] ?? "Error",
    };
    const issues = validationIssues(exception);
    if (status === 400 && issues) {
      problem.issues = issues;
    }
    host.switchToHttp().getResponse<Response>().status(status).type("application/problem+json").json(problem);
  }
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // express-openapi-validator errors carry `status`.
  const status = (exception as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

function validationIssues(exception: unknown): ValidationIssue[] | undefined {
  const errors = (exception as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) {
    return undefined;
  }
  return errors.map((error: { path?: unknown; message?: unknown }) => ({
    path: String(error.path ?? ""),
    message: String(error.message ?? ""),
  }));
}
