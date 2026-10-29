namespace CallCalendar;

/** Адрес календаря: уникальное короткое имя Владельца, из него строится публичная ссылка. */
@minLength(3)
@maxLength(30)
@pattern("^[a-z0-9-]+$")
scalar CalendarSlug extends string;

/** Часовой пояс из базы IANA, например `Europe/Moscow`. Существование пояса проверяет сервер. */
@minLength(1)
@maxLength(64)
@pattern("^[A-Za-z0-9_+\\-/]+$")
scalar TimeZone extends string;

/** Горизонт планирования: на сколько дней вперёд, включая сегодня, можно бронировать Слоты. */
@minValue(1)
@maxValue(60)
scalar PlanningHorizon extends int32;

/** Лимит бронирований: сколько Бронирований один email может сделать у Владельца за день. */
@minValue(1)
@maxValue(18)
scalar DailyBookingLimit extends int32;

@format("email")
@maxLength(254)
scalar Email extends string;

/** Имя человека, как он его ввёл. */
@minLength(1)
@maxLength(100)
scalar PersonName extends string;

@minLength(8)
@maxLength(128)
scalar Password extends string;

@format("uuid")
scalar Uuid extends string;
