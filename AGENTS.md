# AGENTS.md

Guidance for coding agents working in this repository. `CLAUDE.md` only imports this file.

## Project

"Календарь звонков" — a call-booking calendar service built with AI assistance as a Hexlet learning project
(https://ru.hexlet.io/programs/ai-for-developers).

The design is settled; the app skeleton exists and features are built on it issue by issue. Read these before working:

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
- `pnpm spec:build` — regenerate the contract artifacts (see Generated files).
- `pnpm spec:check` — fail if the committed artifacts differ from a fresh compile.
- `pnpm typecheck` — `tsc -b` over every package. Same command as `mise run typecheck`.
- `mise run check` — oxlint (`--deny-warnings`), oxfmt `--check`, `tsc -b`, knip, dependency-cruiser. The pieces
  are `mise run lint`, `format`, `fix` (oxlint `--fix`, then oxfmt), `typecheck`, `knip`, `depcruise`.
- `mise install` also installs the git hooks. pre-commit checks oxlint and oxfmt on staged files only and does not
  autofix; knip, dependency-cruiser and typecheck stay out of it. commit-msg checks the message (see Commits).
- `pnpm test` — Vitest in `spec`, `backend`, `frontend`. A single file: `pnpm --filter backend exec vitest run
  test/<file>`. Backend tests start Postgres through Testcontainers, so Docker must be running.
- `pnpm e2e` — build, then Playwright against the built app and a Testcontainers Postgres.
- `docker compose up --build` — the production image with Postgres, on http://localhost:3000.

Backend integration tests go through `createApp()` with supertest and check every response with `expectMatchesSpec`
(`backend/test/contract.ts`). `spec/test/` checks the contract alone: `express-openapi-validator` over the compiled
YAML, with stub handlers.

## Generated files

The API contract is TypeSpec in `spec/*.tsp`; every API change starts there (ADR-0001). `pnpm spec:build` generates:

- `spec/openapi.yaml` — OpenAPI 3; the backend validates requests against it and tests check responses against it.
- `spec/api.d.ts` — types imported as `spec/api` by the backend and by the frontend SDK (`frontend/src/api.ts`,
  `openapi-fetch` over these types). The frontend calls the API only through that client.

Both files are read-only: change the `.tsp`, run `pnpm spec:build`, commit the outputs with the TypeSpec change. CI
runs `pnpm spec:check` and fails on any drift. NestJS has no TypeSpec server generator, so the backend uses the
shared types and the request validator instead of generated controllers.

## Commits

Every commit names its ticket, and its type in [Conventional Commits](https://www.conventionalcommits.org/) form,
because release-please builds versions and `CHANGELOG.md` from the types:

```
feat(auth): let a visitor register as a Владелец

Refs: #7
```

- Subject: `<type>(<scope>): <sentence>` in English. Types: `feat`, `fix` (these two reach the changelog), `perf`,
  `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`. Scope is optional and free-form. `!` after the type
  marks a breaking change.
- Body ends with the trailer `Refs: #<n>`, the GitHub issue the work belongs to. Work without an issue gets one first.
- PRs are squash-merged; the squash commit is the PR title and body. So the PR title follows the subject rule and the
  body starts with `Closes #<n>`, which puts the ticket into the commit on `main`.
- release-please's own `chore(main): release …` commits and PR, and git's `Revert "…"` and `Merge …`, need no ticket.

The commit-msg hook and the `pr` workflow (`scripts/commit-message.sh`) enforce this.

## Constraints

- `.github/workflows/hexlet-check.yml` is auto-generated and runs Hexlet's automated checks on every push. Do not edit,
  delete, or rename it, and do not rename the repository.
- `README.md` is in Russian; the Использование section is still a placeholder to fill in as the project develops.
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
