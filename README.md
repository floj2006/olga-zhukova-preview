# Ольга Жукова · Next.js

Многостраничный сайт ведущей: Next.js 16.3.8 (App Router), React 19.3.0, Node.js 24. Публичные страницы, бронирование, админка и API находятся в одном приложении. Палитра gold/champagne сохранена, 3D не используется.

## Запуск

Установите Node.js 24, затем:

~~~sh
npm ci
npm run setup:admin
npm run dev
~~~

Сайт: http://127.0.0.1:4173. Админка: http://127.0.0.1:4173/admin.

Пароль находится только в локальном artifacts/admin-access.txt. Настройки .env.local, база .data и artifacts исключены из Git. setup:admin заполняет пустые поля, но не заменяет существующий доступ. Можно предварительно скопировать .env.example в .env.local.

Для другого порта задайте ADMIN_SETUP_ORIGIN до первой настройки. APP_ORIGIN должен совпадать с адресом, через который открывается админка. Например, для порта 4174:

~~~powershell
$env:ADMIN_SETUP_ORIGIN = 'http://127.0.0.1:4174'
npm run setup:admin
npx next dev --webpack --hostname 127.0.0.1 --port 4174
~~~

Не запускайте dev и production-сборку одновременно в одной рабочей папке.

## Страницы

Главная, /about, /events, /events/wedding, /events/corporate, /events/anniversary, /events/graduation, /portfolio, /services, /contacts. Дополнительно /admin и /privacy.

## Бронирование и управление

- Единый сценарий: дата → услуги → контакты. Расчёт, выбранный формат и дата сохраняются при переходах между страницами; имя, телефон и комментарий не записываются в браузерное хранилище.
- Сервер проверяет занятость даты, актуальность цен и повторную отправку. Заявка сама по себе не бронирует дату.
- Ведущая — 8 000 ₽/час; DJ со стандартной аппаратурой — 3 000 ₽/час. Первая консультация бесплатна. Остальные цены и видимость услуг управляются через админку.
- Админка: услуги и цены; поиск, статусы и заметки заявок; занятые даты и приватные пометки; загрузка, подписи, публикация и порядок фотографий; видео, отзывы и условия бронирования.
- Изображения проверяются на сервере и пересохраняются в WebP до 2048 px. Черновики не публикуются. Пустые галерея, видео и отзывы не заполняются вымышленными материалами.
- Конфликты между вкладками не перезаписывают чужие изменения. Ошибки, истечение сессии, повторный вход и отмена запросов обрабатываются с сохранением несохранённых правок там, где это необходимо.
- Уведомления ВК опциональны: заявка сначала сохраняется, затем отправляется уведомление со ссылкой в админку. Телефон, имя и комментарий в ВК не передаются; доступен повтор доставки.

Начальные тарифы применяются при создании хранилища. Четыре часа в первоначальном расчёте — изменяемое значение, а не обязательный минимум. Выезд, предоплата и отмена публикуются только после заполнения и подтверждения владельцем.

## Архитектура

- app — маршруты, metadata, robots, sitemap, ошибки и API.
- components/site — публичные страницы и общий PublicShell; components/booking — единое React-состояние, календарь, расчёт и форма.
- components/admin — оболочка, React-редактор материалов и диагностика запуска. public/admin — контроллер услуг, заявок, календаря и галереи.
- public — фотографии, локальные шрифты, CSS и браузерные модули. Основные цвета заданы в public/styles.css, композиция — в editorial/support/events CSS.
- server — валидация, безопасность, расчёт, файловое/Supabase-хранилище, обработка изображений и уведомления.
- server/next-adapter.mjs — адаптация существующего API к Next Request/Response.
- server/catalog-default.json — начальные услуги; scripts/prepare-public.mjs готовит резервный public/catalog.json при сборке.
- legacy — прежние обработчики, которые больше не загружаются публичными страницами.
- multipage — локальная рабочая копия, исключённая из Git и deployment; публикуется актуальный исходный код в корне репозитория.

## Проверки

~~~sh
npm run check
npm run build
npm run test:setup-admin
npm run test:backend
npm run test:mvp
npm run test:cloud-check
npm run test:seo
npm run test:deployment
npm run test:analytics
npx playwright install chromium webkit
npm test
npm run test:experience
npm run test:loading
npm run test:mvp-browser
npm run test:content-editor
npm run test:admin-regressions
npm run test:gallery
npm run test:booking
npm run test:webkit
npm run test:deployment-browser
npm run test:analytics-browser
npm run test:multipage
npm run test:public-polish
~~~

Браузерные проверки используют предварительную production-сборку и изолированные временные базы с отдельными паролями. Они не меняют рабочую .data и не отправляют реальные уведомления. Для дополнительных движков установите Firefox и задайте BROWSER=firefox или BROWSER=webkit перед test:multipage. Проверки движков не заменяют проверку физического телефона.

CI запускает сборку и эти проверки из чистого checkout. Подробные результаты: [docs/QA.md](docs/QA.md).

## Vercel и постоянное хранение

vercel.json использует Next.js preset и npm run build. Для самостоятельного production-сервера — npm start. Без постоянного облачного хранилища production API возвращает 503; локальный файловый режим применяется только для разработки и изолированных тестов.

Перед приёмом реальных заявок:

1. Создайте Supabase в аккаунте владельца и примените server/schema.sql. Повторное применение функций не удаляет данные.
2. Настройте серверные SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_GALLERY_BUCKET=olga-gallery, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET и HTTPS APP_ORIGIN.
3. Настройте SITE_URL для canonical, Open Graph, robots и sitemap. Preview по умолчанию закрыт от индексации.
4. Выполните npm run check:cloud, затем отдельно проверьте реальную запись, чтение и приватность данных. Диагностика GET сама по себе не подтверждает работу записи.
5. Настройте ВК при необходимости.

Git push не переносит .env.local, рабочую базу или доступы владельца. Секреты задаются в настройках проекта Vercel.

[Подготовка запуска](docs/launch.md) · [Supabase](docs/supabase-setup.md) · [API и админка](docs/admin-backend.md) · [ВК](docs/vk-notifications.md) · [Готовность MVP](docs/mvp-readiness.md).

## Дизайн и измерения

[Аудит](AUDIT.md) · [Архитектура](docs/architecture-audit.md) · [Дизайн](docs/design-decisions.md) · [Копирайт](docs/brand-copy.md) · [Многостраничность](docs/multipage-redesign.md).

Реальные фотографии, видео и отзывы добавляются через админку. Текст, мобильные отступы, меню и анимации проверяются отдельно; позиционные entrance-анимации отключены.

Telemetry передаёт только Web Vitals и фиксированные действия воронки, без контактов, выбранной даты или текста заявки. Сетевой сбор по умолчанию выключен. После включения Web Analytics / Speed Insights в Vercel задайте NEXT_PUBLIC_WEB_ANALYTICS и/или NEXT_PUBLIC_SPEED_INSIGHTS и пересоберите сайт. NEXT_PUBLIC_CONVERSION_ANALYTICS включает действия отдельно. Админка не измеряется, Do Not Track отключает загрузку, параметры URL очищаются.

npm run package:release создаёт исходный архив и manifest в artifacts; команда не публикует сайт и не переносит данные. Секреты, база, логи, зависимости и build artifacts исключены.
