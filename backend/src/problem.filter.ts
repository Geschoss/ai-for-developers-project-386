import { STATUS_CODES } from "node:http";

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { components } from "spec/api";

type ValidationIssue = components["schemas"]["ValidationIssue"];

interface ProblemBody {
  code: string;
  issues?: ValidationIssue[];
  status: number;
  title: string;
}

/** Codes for errors that no feature raises itself: framework 404s, validator rejections, crashes. */
const codeByStatus: Record<number, string> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  415: "unsupported_media_type",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const statusOf = (exception: unknown): number => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // Express-openapi-validator errors carry `status`.
  if (!isRecord(exception)) {
    return 500;
  }
  const { status } = exception;
  if (typeof status === "number" && status >= 400 && status < 600) {
    return status;
  }
  return 500;
};

const validationIssues = (exception: unknown): ValidationIssue[] | undefined => {
  if (!isRecord(exception) || !Array.isArray(exception["errors"])) {
    return undefined;
  }
  return exception["errors"].map((error: unknown): ValidationIssue => {
    if (!isRecord(error)) {
      return { message: "", path: "" };
    }
    return { message: asString(error["message"]), path: asString(error["path"]) };
  });
};

/** Renders every error as RFC 9457 `application/problem+json` with a machine-readable `code`. */
@Catch()
class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const status = statusOf(exception);
    if (status >= 500) {
      this.logger.error(exception);
    }
    const problem: ProblemBody = {
      code: codeByStatus[status] ?? "internal_error",
      status,
      title: STATUS_CODES[status] ?? "Error",
    };
    const issues = validationIssues(exception);
    if (status === 400 && issues !== undefined) {
      problem.issues = issues;
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .type("application/problem+json")
      .json(problem);
  }
}

export { ProblemFilter };
