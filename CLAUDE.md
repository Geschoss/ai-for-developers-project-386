# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Календарь звонков" — a call-booking calendar service built with AI assistance as a Hexlet learning project
(https://ru.hexlet.io/programs/ai-for-developers). Expected behavior is described at https://files.hexlet.app/a/2ipc5m.

The design is settled but no application code exists yet. Read these before working:

- `docs/spec.md` — the full product and technical spec (roles, domain rules, screens, error codes, stack).
- `GLOSSARY.md` — canonical domain terms (Владелец, Гость, Администратор, Слот, Бронирование, Горизонт планирования,
  Лимит бронирований, Адрес календаря). Use these terms in code, docs and commits; avoid the listed synonyms.
- `docs/adr/` — decisions that look surprising; don't "fix" them without a new ADR.

## Stack and layout (planned)

TypeScript on Node 24 LTS, pnpm workspaces monorepo:

- `spec/` — TypeSpec API contract, compiled to a committed `spec/openapi.yaml` (the single source of truth for the API).
  Every API change starts here.
- `backend/` — NestJS, Drizzle + PostgreSQL. Requests are validated by `express-openapi-validator` against the
  OpenAPI file, not by class-validator DTOs (ADR-0001). Types come from `openapi-typescript`.
- `frontend/` — React + Vite + Mantine SPA, API client via `openapi-fetch`.
- `e2e/` — Playwright.

One Docker image: Nest serves `/api/*` plus the built SPA. Deployed to Render; CI is a separate GitHub Actions
workflow. Tests use Vitest everywhere; backend integration tests run against real Postgres via Testcontainers.

The Python guidelines in the user's global CLAUDE.md do not apply to this project. Commands will be added here once
the packages are scaffolded.

## Constraints

- `.github/workflows/hexlet-check.yml` is auto-generated and runs Hexlet's automated checks on every push. Do not edit,
  delete, or rename it, and do not rename the repository.
- `README.md` is in Russian; the Установка and Использование sections are still placeholders to fill in as the
  project develops.
- Admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars; never commit them (the repo is public).

## Agent skills

`.agents/skills/` contains vendored skills from `mattpocock/skills` (code-review, grill-me, grill-with-docs, implement,
implement-spec, retro, to-spec, to-tickets), pinned by hash in `skills-lock.json`. Treat them as third-party content;
don't edit them in place.
