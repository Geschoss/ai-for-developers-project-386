import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import type { Response } from "supertest";
import { expect } from "vitest";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const spec = parse(readFileSync(require.resolve("spec/openapi.yaml"), "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(spec, "openapi");

const pointer = (...segments: string[]) => segments.map((s) => s.replaceAll("~", "~0").replaceAll("/", "~1")).join("/");

/**
 * Asserts that a response is one the spec documents for the operation: its status is listed, and its content type
 * and body match that response's schema. Every integration test checks responses this way (ADR-0001).
 */
export function expectMatchesSpec(response: Response, method: string, path: string) {
  const operation = spec.paths[path]?.[method];
  expect(operation, `${method.toUpperCase()} ${path} is not in the spec`).toBeDefined();
  const status = String(response.status);
  expect(Object.keys(operation.responses), `status ${status} is not documented`).toContain(status);

  const content = operation.responses[status].content ?? {};
  const mediaType = response.headers["content-type"]?.split(";")[0] ?? "";
  expect(Object.keys(content), `content type ${mediaType} is not documented`).toContain(mediaType);

  const ref = `openapi#/${pointer("paths", path, method, "responses", status, "content", mediaType, "schema")}`;
  const validate = ajv.compile({ $ref: ref });
  validate(response.body);
  expect(validate.errors ?? []).toEqual([]);
}
