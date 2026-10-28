# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Календарь звонков" — a call-booking calendar service built with AI assistance as a Hexlet learning project
(https://ru.hexlet.io/programs/ai-for-developers).

The design is settled but no application code exists yet. Read these before working:

- `docs/spec.md` — the source of truth for behavior: roles, domain rules, screens, error codes, stack.
- `docs/reference/` — screenshots of Hexlet's reference app, a visual reference only; the spec deliberately extends
  it (registration, roles, Owner settings).
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

When scaffolding the packages, replace this section with the `pnpm` commands (dev, lint, typecheck, test, e2e) and
leave stack details to `docs/spec.md` and `package.json`.

## Constraints

- `.github/workflows/hexlet-check.yml` is auto-generated and runs Hexlet's automated checks on every push. Do not edit,
  delete, or rename it, and do not rename the repository.
- `README.md` is in Russian; the Установка and Использование sections are still placeholders to fill in as the
  project develops.
- Admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars; never commit them (the repo is public).

## Agent skills

`.agents/skills/` (symlinked as `.claude/skills`) holds vendored `mattpocock/skills`, pinned in `skills-lock.json`.
They are third-party: change behavior via project docs, and update them only through the lock file.

### Issue tracker

Work is tracked as GitHub Issues in this repo, with native blocking edges; `ready-for-agent` issues are meant to be
picked up by agents. Before taking an issue, read the "Taking a ticket" workflow in `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
