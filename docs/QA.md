# QA — редакционная многостраничная версия

Дата: 6 октября 2026. Источник: olga_zhukova_multipage.zip; рабочая папка multipage. Production build: RuaHp9t1_x645ZK7BsHGg. Next 16.3.8 / React 19.3.0 / Node 24. Новых runtime dependencies нет.

## Сборка и существующие проверки

| Проверка | Результат |
| --- | --- |
| npm run build | PASS: 10 public routes, admin, privacy, robots/sitemap, API/uploads, branded 404 |
| npm run check | PASS: 43 support JavaScript modules, JSON и static references |
| backend / mvp / seo / cloud-check / deployment / analytics | PASS: 40/40 |
| site.test.mjs | PASS: services/quantities/reset, lead submission, stale prices, admin/catalog/leads/gallery, mobile, accessibility |
| experience.test.mjs | PASS: private calendar notes, bulk edits, availability, stale dates, gallery optimization/order/featured, lightbox keyboard/swipe |
| loading.test.mjs | PASS: nonblocking loading, calendar-first flow, focus, reduced motion, errors, no JS, restored date |
| mvp-browser.test.mjs | PASS: metadata/headers, empty estimate, CMS publish/hide, overflow, accessibility |
| content-editor.test.mjs | PASS: preview/XSS, conflicts/drafts/copy, cancellation/expired session/logout, mobile |
| gallery.test.mjs | PASS: shared catalog, safe URLs/captions, lazy chunk, cancellation, keyboard/focus, empty/single gallery |
| booking-react.test.mjs | PASS: Chromium и mobile WebKit; state/retry/privacy, date/services/contact, late responses, 320/390/1440 и constrained viewport |
| analytics-browser.test.mjs | PASS: disabled default, redaction, queues/sampling/cleanup, admin exclusion, Do Not Track; mock collector |
| deployment-browser.test.mjs | PASS: launch status permissions, configuration/offline UI, drafts, safe rendering, palette, accessibility; no real cloud/VK calls |
| npm run package:release | PASS: 151 source/public files; private env/data/logs/dependencies/build artifacts excluded |

Исходные тесты не удалены. loading.test.mjs проверяет новый переход «Мероприятия» на /events вместо прежнего #events; multipage-browser.test.mjs использует актуальную кнопку расчёта формата вместо удалённого повторного hero. experience.test.mjs уточняет селектор карточки, поскольку data-event теперь есть также у кнопки расчёта. Assertions бизнес-логики и доступности сохранены. ZIP не содержал dist; для старых upload fixtures подготовлены только три изображения из текущего public. Next не обслуживает dist; папка исключена из Git/release.

Предупреждение Next в test runner о снятии unhandledRejection filter — stdout runner, не ошибка консоли сайта.

## Новая multipage regression suite

Команда: BROWSER=chromium / webkit / firefox node tests/multipage-browser.test.mjs. Соответствующая переменная среды задаётся средствами используемой shell.

Каждый engine: 96 cases, 0 failures, 0 runtime errors. Все десять маршрутов проверены на 360, 390, 430, 768, 1024, 1280, 1440 и 1920 px.

- Всего 240 responsive checks и 60 axe audits (390/1440, WCAG 2 A/AA и 2.1 AA).
- Уникальные title/description, canonical и OG/Twitter каждой страницы, один h1, уникальные IDs, image dimensions.
- Internal destinations, hash targets, image responses: без 404 и сломанных ресурсов.
- Hero/CTA в viewport; horizontal overflow, fixed header, footer, reduced motion.
- Все четыре event formats: hero/package/final CTA сохраняют тип и открывают дату; keyboard/focus return.
- Fullscreen mobile menu: focus trap/Escape, menu → booking, видимый opener, снятие inert/body lock.
- Native document navigation: услуги, количество, дополнительные встречи, дата и формат восстанавливаются; имя/телефон/комментарий не сохраняются.
- API failure/fallback/retry: один shared catalog, актуальные цены и галерея после retry, без старых параллельных controllers.

Reports/screenshots: artifacts/multipage-browser-{chromium,webkit,firefox}/. WebKit проверен также с mobile/touch/DPR2. Это browser-engine проверки на Windows, а не физические Safari/iPhone/Android устройства.

## Визуальный проход

Проверены screenshot всех десяти страниц desktop/mobile, ритм разделов, размеры текста, фотографии, CTA и footer. Дополнительно artifacts/final-visual/: viewport screenshots hero, mobile menu, calendar, services, contacts при обычном движении; 9 axe audits, 0 violations, 0 runtime errors. После диагностики позиционные entrance animations отключены; отдельный public-polish test проверяет неподвижность элементов в реальных кадрах.

Исправлены: наложение event image/copy из старой grid, min-content overflow footer, пересечение monogram, contrast program label на ivory, malformed corporate image srcSet, размеры фотографий. Для mobile fields сохранены 16px; reduced motion/coarse pointer отключают декоративные transforms.

Статичный публичный контент доступен без JS. Для интерактивного калькулятора, CMS и отправки нужна JavaScript; при недоступности API показаны состояния ошибки/повторения и телефон.

## Performance snapshot

artifacts/performance.json: 3 cold-context Chromium samples на route/viewport, production runner, localhost, без CPU/network throttling, обычное движение и пустой seed CMS.

| Route | Initial JS raw / gzip estimate | CSS raw / gzip estimate | LCP desktop/mobile, median | CLS desktop/mobile |
| --- | --- | --- | --- | --- |
| / | 500.0 / 149.3 KiB | 162.8 / 30.0 KiB | 224 / 200 ms | 0.00592 / 0 |
| /services | 493.0 / 147.0 KiB | 162.8 / 30.0 KiB | 152 / 152 ms | 0.00835 / 0 |
| /portfolio | 493.2 / 147.1 KiB | 162.8 / 30.0 KiB | 104 / 108 ms | 0.00395 / 0 |

Long tasks: 0–2 на загрузку; максимум 163ms. Все assets HTTP200. Это лабораторный локальный снимок, не field Core Web Vitals, не Lighthouse score и не прогноз реального mobile INP. Реальная галерея/видео, Supabase, сеть и устройства требуют повторного измерения после наполнения/deploy.

## Защита существующей системы

Независимый review: SHA256 49 protected files, 48 совпадают с исходником. Единственное отличие BookingProvider — минимальный guard совмещённого event/booking CTA. Цены, расчёт, stores, Calendar, RequestForm, Calculator, API/server, uploads, admin, версии, idempotency и CSRF сохранены.

Палитра источника сохранена; shared tokens добавляют aliases/scale, не заменяют значения. В public shell нет GSAP/Lenis/Motion/Three runtime, второго booking/store или fabricated cases.

## Preview и production boundaries

Новая локальная копия работает на http://127.0.0.1:4174. После запуска подтверждены HTTP200 всех десяти публичных страниц, /admin, /api/catalog и /api/availability?month=2026-10. Запрос availability без обязательного month ожидаемо возвращает 400. Исходный проект на 4173 сохранён. Preview использует собственные локальные тестовые настройки и пустое seed-хранилище. Исходные секреты и клиентские данные не переносились.

Не проверены реальные Supabase, уведомления ВК и опубликованный домен. Production fail-closed policy сохранена. Перед публичным запуском нужны доступы владельца, проверка реальной записи/чтения и публикация; реальные фото/видео/отзывы, согласованные условия выезда/оплаты/переноса/отмены и разрешения на материалы.

Автоматическая проверка отклонила перенос родительских .env.local/.data из-за риска смешивания секретов и заявок. Копирование не выполнено; использована самостоятельная локальная тестовая настройка.


## Дополнительная проверка адаптива, текста и движения

Финальная production-сборка повторно проверена после CSS-исправлений. multipage-browser: Chromium / WebKit / Firefox — по 96 cases, 240 responsive checks и 60 axe audits суммарно, 0 failures и 0 runtime errors. booking проверен в Chromium и mobile WebKit; loading, experience и gallery также PASS. Ранее пройденные 40 backend/unit checks и остальные admin/integration suites относятся к неизменённому функциональному слою.

public-polish.test.mjs: PASS 14/14, runtime errors 0. Изолированное временное хранилище, mock-каталог, обычное движение. Проверены:

- Читаемость и overflow на 360×844, 390×844, 768×1024, 1024×900, 1024×600, 1366×768, 1440×1000.
- Шапка при пересечении scroll boundary, видимые hero/anchor/reveal без translate; переключение reduced motion не проигрывает просмотренный текст повторно.
- Четыре homepage format tabs, окно деталей телефонного разговора и portal lightbox без позиционных анимаций.
- Четыре кнопки расчёта формата открывают дату, сохраняют тип, затем услуги; panels/calendar animationName none, Escape возвращает фокус.
- Меню на 901, 1024, 1200, 1201px; focus trap/Escape, снятие inert/body lock, переход к Events и закрытие при resize 1024→1280.
- Задержанная публикация двух тестовых фотографий: CLS 0 на 390/1440, контактный блок не появляется на промежуточном кадре. Это fixture-проверка, не измерение будущей реальной галереи.

artifacts/live-responsive-polish/report.json: ещё 30 normal-motion комбинаций пяти страниц/шести viewport, 0 overflow/вышедших элементов/page errors; первая CTA помещается в исходный экран, в том числе home/about на 1024×600. Event worker проверил 40 комбинаций всех пяти event routes; отчёт artifacts/event-responsive-20261006/final/summary.json. Визуально просмотрены hero/mobile menu/services/events/about; размеры текста дополнительно проверены вычисленными стилями.

Независимый code review нашёл и проверил исправления: menu display на 901–1200px, совпадение CSS-reset с DOM табпанелей, legacy format/contact/lightbox motion. Финальный review не выявил новых actionable issues. SHA256 49 защищённых файлов повторён: 48 исходных, единственный ожидаемый guard BookingProvider, отсутствующих файлов нет.

Публичные служебные формулировки заменены клиентскими пояснениями. Реальные события, отзывы и результаты не выдумывались. Палитра, цены, данные и архитектура не изменены.
## Админка и подготовка Git — 8 октября 2026

Актуальные исходники синхронизированы в корень репозитория без удаления существующих файлов. Все заменённые исходники предварительно сверены с локальной резервной копией. Рабочие .env.local, .data и artifacts не копировались между проектами. Папка multipage остаётся локальным preview и не публикуется как вторая копия.

Исправления:
- Поздние ответы каталога, календаря и галереи не восстанавливают приватные записи после выхода. Истечение сессии отменяет старые операции; повторный вход восстанавливает несохранённые правки.
- Изменение, удаление и загрузка фотографий сериализованы с обновлением, сортировкой и сохранением каталога.
- Конфликт заявки позволяет сравнить свежие данные, принять их либо явно применить свой черновик перед отдельным сохранением.
- Неудачная загрузка заявок сохраняет предыдущие строки и черновик; ручной идентификатор новой услуги переживает повторное построение формы.
- Сохранение цен возвращает администратору также скрытые фотографии; публичный API продолжает исключать черновики.
- setup:admin заполняет пустой шаблон и экранирует разделители хеша для настоящего загрузчика Next .env. Исправление существующего хеша не меняет пароль или ключ сессии. Локальный CLI читает тот же формат; в переменных Vercel нужен хеш без обратных слешей.

Проверки:
- Production build и check в корне: PASS. Build ID P82KOYCsUTqjmX-JYv0FY; 10 публичных маршрутов, админка, privacy, SEO и API/uploads.
- Backend / MVP / SEO / cloud-check / deployment / analytics / setup: 49/49 PASS.
- Admin regressions: 10/10 PASS — поздние ответы после выхода, сбой обновления заявок, конфликт/отмена черновика, блокировка конкурентных действий с фото, сохранение ручного ID, поздний upload и восстановление цены после истечения сессии.
- site / experience / content-editor / mvp-browser / deployment-browser: PASS. Правки цен, видимости услуг, фотографий, видео, отзывов и условий дополнительно проверены на /services и /portfolio.
- Booking Chromium и mobile WebKit, loading: PASS.
- Multipage Chromium из корня: 96 cases, 80 responsive checks и 20 axe audits; PASS, ошибок браузера нет.
- Public polish из корня: 14/14 PASS; gallery и analytics-browser PASS.
- Настоящий локальный вход на http://127.0.0.1:4174/admin проверен через текущие приватные настройки без смены пароля, изменения рабочей базы или публикации секретов; 0 runtime errors.
- Upload fixtures используют public, не игнорируемый dist. CI дополнен настройкой доступа, admin regressions, multipage и public polish.

Supabase и ВК в текущих настройках не подключены. Реальная облачная запись и публичный домен не проверены. Git не переносит доступы или клиентские данные; production fail-closed остаётся обязательным до настройки постоянного хранилища.
