# Календарь звонков


[![hexlet-check](https://github.com/Geschoss/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Geschoss/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- API-контракт: TypeSpec → OpenAPI
- Бэкенд: NestJS, TypeScript, Drizzle, PostgreSQL
- Фронтенд: React, TypeScript, Vite, Mantine
- Тесты: Vitest, Testcontainers, Playwright
- Развёртывание: Docker, GitHub Actions, Render

## Установка

Нужны [mise](https://mise.jdx.dev/) (ставит Node и pnpm нужных версий из `mise.toml`) и Docker.

```bash
git clone https://github.com/Geschoss/ai-for-developers-project-386.git
cd ai-for-developers-project-386
mise install
pnpm install
```

Запуск всего приложения с базой — в Docker, на http://localhost:3000:

```bash
docker compose up --build
```

Режим разработки: база в Docker, бэкенд и фронтенд с перезагрузкой, фронтенд на http://localhost:5173:

```bash
docker compose up -d db
cp .env.example backend/.env
pnpm dev
```

Проверки: `pnpm typecheck`, `pnpm test` (нужен запущенный Docker), `pnpm e2e`.

## Использование

<!-- Добавьте примеры запуска и запись asciinema — именно это смотрит работодатель -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
