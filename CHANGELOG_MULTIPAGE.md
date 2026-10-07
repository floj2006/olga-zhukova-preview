# Multipage redesign — что изменено

## Добавлено
- Общая публичная оболочка `components/site/PublicShell.jsx`.
- Универсальный layered hero `PageHero.jsx`.
- Универсальный шаблон событийных страниц `EventPage.jsx`.
- Контент событий вынесен в `lib/event-pages.js`.
- Страницы `/about`, `/events`, `/events/wedding`, `/events/corporate`, `/events/anniversary`, `/events/graduation`, `/portfolio`, `/services`, `/contacts`.
- Многостраничная навигация в header/footer.
- Editorial/multilayer CSS в `public/editorial-pages.css`.
- Progressive View Transitions, pointer-depth и reduced-motion fallback.
- Расширенный sitemap и metadata/canonical для новых страниц.
- Документация `docs/multipage-redesign.md`.

## Сохранено без изменений
- `server/` — API, расчёты, валидация, Supabase, заявки, календарь, фото, уведомления.
- `components/booking/` — состояние и сценарий бронирования.
- `components/admin/` + `public/admin/` — админка.
- `public/catalog-store.js`, `availability-store.js`, `booking-rules.js`.

## Проверки
- Все JS/JSX/MJS файлы проходят Babel parser: 0 синтаксических ошибок.
- Серверные/MVP/deployment тесты: 33/33 пройдены.
- SEO/analytics/cloud-check тесты: 7/7 пройдены.
- Ссылки на изображения и новые route-файлы проверены.
- Полный Next build в этой Linux-песочнице не завершён только потому, что исходный `node_modules` из архива содержит Windows SWC, а среда без интернета не может скачать Linux SWC. В релиз `node_modules` не включён: обычный `npm ci` на целевой машине установит правильный бинарник.
