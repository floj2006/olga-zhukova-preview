# Архитектурный аудит и границы изменений

Дата: 6 октября 2026. Исходник: Desktop/olga_zhukova_multipage.zip. Рабочая копия: workspace/multipage. Родительский одностраничный проект не заменялся и не откатывался. Архив распакован, а не пересоздан с шаблона.

## Карта существующей системы

| Слой | Источник | Контракт |
| --- | --- | --- |
| Business logic | components/booking/BookingProvider.jsx, public/booking-rules.js, public/catalog-store.js | Одна дата, тип события, выбранные услуги, количество, расчёт, idempotency и состояния заявки |
| Data | server/storage.mjs, server/content.mjs | Существующие local/Supabase адаптеры, опубликованные материалы, версии, независимая занятость |
| Server/API | app/api/[...path], app/uploads/[filename], server/next-adapter.mjs, server/index.mjs | Цены и дата перепроверяются на сервере; авторизация, CSRF, rate limits, ограничения файлов |
| Admin | app/admin, components/admin, public/admin | Существующие цены, заявки, календарь, галерея, материалы, условия и статус запуска |
| Presentation | app/*/page.jsx, components/site | Десять публичных маршрутов; PublicShell на каждой странице |
| Shared UI | Header, Footer, PageHero, Formats, Contact, Calculator, dialogs | Общий язык интерфейса без второго калькулятора или второго booking |
| Motion | PublicMotion, CSS, существующий GalleryTile | Один native motion approach: WAAPI, IntersectionObserver, CSS; без smooth-scroll runtime |

Публичная навигация остаётся обычными ссылками. Provider сохраняет разрешённый черновик выбора в sessionStorage; имя, телефон и комментарий туда не записываются. Это существующее архитектурное решение, а не перенос routing/state из референсов.

## Найденные и исправленные проблемы

1. Ссылки на #calculator на страницах без калькулятора. Теперь overview ведёт в /services#calculator; на главной сохранён работающий локальный переход.
2. Совмещённые data-event и data-discuss только меняли формат, но не открывали заявку. Минимальный guard в provider позволяет открыть первый шаг даты; обычные event links продолжают навигацию.
3. Мобильный booking CTA запоминал элемент закрытого меню. Теперь opener — видимая кнопка меню; Escape/закрытие возвращают фокус.
4. Повторная загрузка каталога не обновляла императивный gallery bridge. Новый GalleryDataBridge получает тот же каталог из provider, без второго fetch/store.
5. Analytics пропускала только главную. Добавлен фиксированный allowlist десяти public routes; admin, API, неизвестные пути, query/hash и персональные данные остаются исключёнными.
6. Стоковые фотографии были представлены как реальные работы. Портфолио показывает только опубликованные CMS-материалы; фотографии форматов подписаны как иллюстрация атмосферы.
7. Клиентский текст услуг объяснял server/admin. Заменён объяснением стоимости, состава и подтверждения условий.
8. Повторяющиеся страницы About и длинная подача Services. Теперь отдельные композиции: профиль/принципы; ранний калькулятор; прямой контакт.
9. Gold-текст на ivory-фоне в программе не проходил contrast. Текст использует существующий dark; золотая линия остаётся акцентом.

## Защищённые файлы

До изменения зафиксированы SHA256 49 файлов в artifacts/protected-baseline.json. Не менялись server/, admin, API/upload handlers, Calendar, RequestForm, правила, stores, Calculator, ServicePicker, QuoteLines, CMS consumers, GalleryClient/Tile/Lightbox и public/gallery.js.

Единственное исключение — описанный guard BookingProvider для совмещённого CTA. Цены, расчёт, допустимые количества, API payload, серверная перепроверка, защита, persistence и idempotency не менялись. GalleryDataBridge является UI-адаптером над существующим provider.

## Изоляция проверки

Рабочая копия использует собственные тестовые локальные настройки и хранилище. Перенос исходного .env.local/.data был отклонён автоматической проверкой; копирование не выполнялось. Исходные секреты, заявки и галерея в родительской папке не затронуты. Browser regression suites также создают отдельные временные базы.

Для сохранённых тестов загрузки подготовлены только dist/olga.jpg, dist/images/evening.jpg и dist/images/celebration.jpg из соответствующих текущих public-файлов. Это тестовый fixture, а не восстановление старой версии: Next не обслуживает dist. В production-package этот каталог не входит.

## Production boundaries

Настоящие Supabase и VK не проверены без соответствующего доступа. Fail-closed production policy сохранена. Условия выезда, предоплаты и отмены публикуются только через существующий редактор подтверждённых условий. Реальные фото, видео и отзывы требуют наполнения CMS; чужие кейсы, клиенты и показатели не добавлены.