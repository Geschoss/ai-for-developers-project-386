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

## Commands

pnpm workspace (`spec/`, `backend/`, `frontend/`, `e2e/`). Node and pnpm versions are pinned in `mise.toml`; run
`mise install` once, and use mise's pnpm: a globally installed pnpm of another major rewrites `pnpm-lock.yaml`. From
the repo root:

- `pnpm install`
- `pnpm dev` — backend (Nest, watch, port 3000) and frontend (Vite, proxies `/api` to 3000). Needs Postgres: `docker
  compose up -d db` and `backend/.env` copied from `.env.example`.
- `pnpm spec:build` — compile `spec/*.tsp` into `spec/openapi.yaml` and the shared types `spec/api.d.ts` (import them
  as `spec/api`). Never edit either by hand; commit them with the TypeSpec change.
- `pnpm spec:check` — fail if the committed `spec/openapi.yaml` or `spec/api.d.ts` differ from a fresh compile.
- `pnpm typecheck` — `tsc -b` over every package.
- `pnpm test` — Vitest in `spec`, `backend`, `frontend`. A single file: `pnpm --filter backend exec vitest run
  test/<file>`. Backend tests start Postgres through Testcontainers, so Docker must be running.
- `pnpm e2e` — build, then Playwright against the built app and a Testcontainers Postgres.
- `docker compose up --build` — the production image with Postgres, on http://localhost:3000.

Backend integration tests go through `createApp()` with supertest and check every response with `expectMatchesSpec`
(`backend/test/contract.ts`). `spec/test/` checks the contract alone: `express-openapi-validator` over the compiled
YAML, with stub handlers.

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
