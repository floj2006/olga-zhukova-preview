# Многостраничная editorial-версия

Новая версия расширяет существующий MVP без замены бизнес-логики.

## Что не менялось

- `server/` — расчёт, валидация, заявки, календарь, Supabase, загрузка фото, уведомления.
- `components/booking/` — единое React-состояние бронирования и отправки заявки.
- `components/admin/` и `public/admin/` — рабочая админка.
- `public/catalog-store.js`, `public/availability-store.js`, `public/booking-rules.js` — клиентские правила и загрузка данных.

## Новые публичные маршруты

- `/about` — отдельная история о ведущей и подходе.
- `/events` — обзор форматов.
- `/events/wedding` — свадьбы.
- `/events/corporate` — корпоративы.
- `/events/anniversary` — юбилеи и семейные события.
- `/events/graduation` — выпускные.
- `/portfolio` — визуальная витрина + динамическая галерея, видео и отзывы из админки.
- `/services` — процесс, калькулятор, FAQ и заявка.
- `/contacts` — способы связи и быстрый вход в бронирование.

## Архитектура

`PublicShell.jsx` собирает общую оболочку публичных страниц: BookingProvider, header, booking dialog, footer, telemetry и существующие browser controllers. Поэтому все новые страницы работают с тем же каталогом, календарём и заявкой, что и главная.

`EventPage.jsx` — единый шаблон четырёх событийных страниц. Контент хранится в `lib/event-pages.js`, поэтому новые форматы можно добавлять без копирования разметки.

`public/editorial-pages.css` — изолированный слой визуального оформления новых страниц. Старые стили калькулятора, календаря, галереи и админки не переписывались.

## Motion

Используются существующий IntersectionObserver, pointer-depth и CSS transitions. Для современных браузеров добавлен progressive enhancement через cross-document View Transitions. При `prefers-reduced-motion: reduce` переходы отключаются.

## SEO

`app/sitemap.js` содержит все публичные коммерческие страницы, исключая admin/API/privacy. На каждой новой странице есть собственные title, description и canonical.

## Проверка

JS/JSX/MJS исходники проходят синтаксический разбор Babel parser из Next.js. Серверные/бэкенд тесты проекта проходят без изменений бизнес-логики. Полный Next build в изолированной Linux-среде может требовать загрузки Linux SWC, если `node_modules` был установлен на Windows; на чистом `npm ci` нужная платформа устанавливается автоматически.
