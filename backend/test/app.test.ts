import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { expectMatchesSpec } from "./contract.js";

let database: StartedPostgreSqlContainer;
let app: INestApplication;

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  const spaDir = mkdtempSync(join(tmpdir(), "spa-"));
  writeFileSync(join(spaDir, "index.html"), "<!doctype html><title>SPA</title>");
  app = await createApp({ databaseUrl: database.getConnectionUri(), spaDir });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await database?.stop();
});

describe("GET /api/health", () => {
  it("answers 200 as the spec describes", async () => {
    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expectMatchesSpec(response, "get", "/api/health");
  });
});

describe("startup", () => {
  it("applies migrations", async () => {
    const client = new pg.Client({ connectionString: database.getConnectionUri() });
    await client.connect();
    try {
      const { rows } = await client.query("select count(*)::int as applied from drizzle.__drizzle_migrations");
      expect(rows[0].applied).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });
});

describe("a request that breaks the spec", () => {
  it("gets 400 problem+json naming the offending field", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ name: "Анна", email: "not-an-email", password: "long-enough", calendarSlug: "anna", timeZone: "UTC" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "validation_failed",
      status: 400,
      issues: [expect.objectContaining({ path: "/body/email" })],
    });
    expectMatchesSpec(response, "post", "/api/auth/register");
  });
});

describe("paths outside /api", () => {
  it.each(["/", "/u/anna", "/register"])("serve the SPA at %s", async (path) => {
    const response = await request(app.getHttpServer()).get(path);

    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>SPA</title>");
  });

  it("do not swallow unknown API paths", async () => {
    const response = await request(app.getHttpServer()).get("/api/nope");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
  });
});
