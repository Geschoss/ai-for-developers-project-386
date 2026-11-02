# Защитный тест: красный и зелёный прогон

Правило «Бронирования одного Календаря не пересекаются» охраняет `backend/test/booking-overlap.test.ts`. Тест
заводит два Типа события: 60 минут в 10:00 и 30 минут в 10:30. Вторая запись должна получить 409 `slot_taken`,
а стык в 11:00 должен пройти. Отдельный тест отправляет обе записи одновременно и ждёт ровно одного победителя.

Правило держится в двух местах (ADR-0009): проверка полуинтервалов в агрегате Календарь и exclusion-ограничение
`bookings_no_overlap` в Postgres. Если сломать одно из них, второе всё равно отклонит запись, поэтому для
красного прогона сломаны оба.

Прогон сделан в PR #73 (тикет #72). Сломанный код в `main` не попал.

## Красный: правило сломано

Коммит `cfdea3f`:

- `backend/src/scheduling/domain/calendar.ts` — `rejectOverlap` сравнивает только начала;
- `backend/drizzle/0005_event_types.sql` — ограничение `bookings_no_overlap` снято.

CI: https://github.com/Geschoss/ai-for-developers-project-386/actions/runs/41473400414

Линтеры, форматирование, типы, knip, dependency-cruiser и проверка контракта прошли. `mise run check` упал на
тестах бэкенда:

```text
FAIL  test/booking-overlap.test.ts > пересечение Бронирований разных Типов событий > rejects 30 minutes at 10:30 after 60 minutes at 10:00 and accepts 11:00
AssertionError: expected 201 to be 409 // Object.is equality
 ❯ test/booking-overlap.test.ts:173:28

FAIL  test/booking-overlap.test.ts > пересечение Бронирований разных Типов событий > gives an overlapping pair to exactly one of two simultaneous Гости
AssertionError: expected [ …(2) ] to have a length of 1 but got 2
 ❯ expectOneWinner test/booking-overlap.test.ts:144:19

FAIL  test/calendar.test.ts > intervals of different Типы событий > rejects an overlap and accepts the abutment
AssertionError: expected undefined to be 'slot_taken' // Object.is equality

Test Files  2 failed | 19 passed (21)
     Tests  3 failed | 102 passed (105)
```

## Зелёный: правило восстановлено

Коммит `0482f9e` откатывает поломку. Код правила снова совпадает с `main`.

CI: https://github.com/Geschoss/ai-for-developers-project-386/actions/runs/41473932677

`mise run check` прошёл целиком, включая e2e:

```text
 ✓ test/booking-overlap.test.ts (2 tests)
 Test Files  21 passed (21)
      Tests  105 passed (105)
```

## Повторить локально

Нужен запущенный Docker. Сломайте правило в обоих местах, затем выполните:

```sh
pnpm --filter backend exec vitest run test/booking-overlap.test.ts
```
