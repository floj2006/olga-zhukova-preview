import LaunchStatus from "./LaunchStatus";
import ContentPanel from "./ContentPanel";
export default function AdminMarkup() {
  return (
    <div className="admin-body">
      <a className="skip-link" href="#admin-main">
        {"Перейти к содержимому"}
      </a>
      <header className="admin-header">
        <a
          className="admin-brand"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="admin-monogram" aria-hidden="true">
            {"ОЖ"}
          </span>
          <span>
            <strong>{"Ольга Жукова"}</strong>
            <small>{"Управление сайтом"}</small>
          </span>
        </a>
        <div className="admin-header-actions">
          <a href="/" target="_blank" rel="noopener noreferrer">
            {"Открыть сайт ↗"}
          </a>
          <button
            id="logout"
            className="admin-button secondary"
            type="button"
            hidden={true}
          >
            {"\n          Выйти\n        "}
          </button>
        </div>
      </header>
      <main id="admin-main" className="admin-main">
        <p id="session-loading" className="admin-loading" role="status">
          {"\n        Проверяем вход…\n      "}
        </p>
        <section
          id="login-view"
          className="admin-login"
          aria-labelledby="login-title"
          hidden={true}
        >
          <p className="admin-kicker">{"Личный кабинет"}</p>
          <h1 id="login-title">{"Вход в управление"}</h1>
          <p className="admin-muted">
            {
              "\n          Услуги, заявки клиентов, календарь и фотографии на сайте.\n        "
            }
          </p>
          <form id="login-form">
            <label className="admin-field" htmlFor="password">
              {"Пароль\n            "}
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required={true}
                maxLength="256"
              />
            </label>
            <button id="login-submit" className="admin-button" type="submit">
              {"\n            Войти\n          "}
            </button>
          </form>
          <p
            id="login-message"
            className="admin-message"
            role="status"
            aria-live="polite"
          ></p>
          <button
            id="session-retry"
            className="admin-button secondary"
            type="button"
            hidden={true}
          >
            {"\n          Проверить снова\n        "}
          </button>
        </section>
        <div id="workspace" hidden={true}>
          <LaunchStatus />
          <nav
            className="admin-tabs"
            aria-label="Разделы управления"
            role="tablist"
          >
            <button
              id="tab-services"
              role="tab"
              aria-selected="true"
              aria-controls="panel-services"
              data-tab="services"
              type="button"
            >
              {"\n            Услуги\n          "}
            </button>
            <button
              id="tab-leads"
              role="tab"
              aria-selected="false"
              aria-controls="panel-leads"
              tabIndex="-1"
              data-tab="leads"
              type="button"
            >
              {"\n            Заявки\n          "}
            </button>
            <button
              id="tab-calendar"
              role="tab"
              aria-selected="false"
              aria-controls="panel-calendar"
              tabIndex="-1"
              data-tab="calendar"
              type="button"
            >
              {"\n            Календарь\n          "}
            </button>
            <button
              id="tab-gallery"
              role="tab"
              aria-selected="false"
              aria-controls="panel-gallery"
              tabIndex="-1"
              data-tab="gallery"
              type="button"
            >
              {"\n            Галерея\n          "}
            </button>
            <button
              id="tab-content"
              role="tab"
              aria-selected="false"
              aria-controls="panel-content"
              tabIndex="-1"
              data-tab="content"
              type="button"
            >
              Материалы
            </button>
          </nav>
          <ContentPanel />
          <p
            id="workspace-message"
            className="admin-message"
            role="status"
            aria-live="polite"
          ></p>
          <section
            id="panel-services"
            className="admin-panel"
            role="tabpanel"
            aria-labelledby="tab-services"
          >
            <div className="admin-heading">
              <div>
                <p className="admin-kicker">{"Каталог на сайте"}</p>
                <h1>{"Услуги и цены"}</h1>
                <p className="admin-muted">
                  {
                    "\n                Изменения появятся на сайте после сохранения.\n              "
                  }
                </p>
              </div>
              <button
                id="add-service"
                className="admin-button secondary"
                type="button"
                disabled={true}
              >
                {"\n              + Добавить услугу\n            "}
              </button>
            </div>
            <p className="admin-rule">
              {
                "\n            Первая встреча бесплатна. Тариф консультации применяется к каждой\n            следующей встрече.\n          "
              }
            </p>
            <p
              id="catalog-status"
              className="admin-message"
              role="status"
              aria-live="polite"
            ></p>
            <div id="catalog-conflict" className="admin-conflict" hidden={true}>
              <p>
                {
                  "\n              Каталог изменён в другой вкладке. Загрузите свежую версию и\n              повторите свои изменения.\n            "
                }
              </p>
              <button
                id="catalog-reload-conflict"
                className="admin-button secondary"
                type="button"
              >
                {"\n              Загрузить свежую версию\n            "}
              </button>
            </div>
            <form id="services-form">
              <div id="services-list" className="admin-list"></div>
              <div className="admin-savebar">
                <p id="services-dirty" className="admin-muted">
                  {"\n                Каталог загружается…\n              "}
                </p>
                <div className="admin-actions">
                  <button
                    id="catalog-reload"
                    className="admin-button secondary"
                    type="button"
                  >
                    {"\n                  Обновить\n                "}
                  </button>
                  <button
                    id="catalog-save"
                    className="admin-button"
                    type="submit"
                    disabled={true}
                  >
                    {
                      "\n                  Сохранить изменения\n                "
                    }
                  </button>
                </div>
              </div>
            </form>
          </section>
          <section
            id="panel-leads"
            className="admin-panel"
            role="tabpanel"
            aria-labelledby="tab-leads"
            hidden={true}
          >
            <div className="admin-heading">
              <div>
                <p className="admin-kicker">{"Обращения клиентов"}</p>
                <h1>{"Заявки"}</h1>
                <p className="admin-muted">
                  {
                    "\n                Контакты, выбранные услуги и расчёт на момент отправки.\n              "
                  }
                </p>
              </div>
              <button
                id="leads-refresh"
                className="admin-button secondary"
                type="button"
              >
                {"\n              Обновить\n            "}
              </button>
            </div>
            <div className="admin-filters">
              <label className="admin-field" htmlFor="leads-search">
                {"Поиск по всем заявкам\n              "}
                <input
                  id="leads-search"
                  maxLength="200"
                  type="search"
                  placeholder="Имя, телефон или мероприятие"
                  autoComplete="off"
                />
              </label>
              <label className="admin-field" htmlFor="leads-filter">
                {"Статус\n              "}
                <select id="leads-filter">
                  <option value="">{"Все статусы"}</option>
                  <option value="new">{"Новая"}</option>
                  <option value="contacted">{"Связались"}</option>
                  <option value="booked">{"Забронировано"}</option>
                  <option value="closed">{"Закрыта"}</option>
                </select>
              </label>
            </div>
            <p
              id="leads-message"
              className="admin-message"
              role="status"
              aria-live="polite"
            ></p>
            <div id="leads-list" className="admin-list"></div>
            <div className="admin-pagination">
              <p id="leads-count" className="admin-muted"></p>
              <button
                id="leads-more"
                className="admin-button secondary"
                type="button"
                hidden={true}
              >
                {"\n              Загрузить ещё\n            "}
              </button>
            </div>
          </section>
          <section
            id="panel-calendar"
            className="admin-panel"
            role="tabpanel"
            aria-labelledby="tab-calendar"
            hidden={true}
          >
            <div className="admin-heading">
              <div>
                <p className="admin-kicker">{"Планирование мероприятий"}</p>
                <h1>{"Календарь занятости"}</h1>
                <p className="admin-muted">
                  {
                    "\n                Отметьте занятые даты. Изменения сразу сохраняются и появляются\n                на сайте.\n              "
                  }
                </p>
              </div>
              <button
                id="calendar-refresh"
                className="admin-button secondary"
                type="button"
              >
                {"\n              Обновить\n            "}
              </button>
            </div>
            <p
              id="calendar-message"
              className="admin-message"
              role="status"
              aria-live="polite"
            ></p>
            <div className="admin-calendar-layout">
              <div className="admin-calendar" id="calendar-editor">
                <div className="admin-calendar-navigation">
                  <button
                    id="calendar-prev"
                    className="admin-button secondary"
                    type="button"
                    aria-label="Предыдущий месяц"
                  >
                    {"\n                  ←\n                "}
                  </button>
                  <h2 id="calendar-month" aria-live="polite"></h2>
                  <button
                    id="calendar-next"
                    className="admin-button secondary"
                    type="button"
                    aria-label="Следующий месяц"
                  >
                    {"\n                  →\n                "}
                  </button>
                </div>
                <div className="admin-calendar-jump">
                  <label className="admin-field" htmlFor="calendar-jump">
                    {"Перейти к месяцу\n                  "}
                    <input
                      id="calendar-jump"
                      type="month"
                      min="2000-01"
                      max="2099-12"
                      aria-describedby="calendar-jump-help"
                    />
                  </label>
                  <button
                    id="calendar-today"
                    className="admin-button secondary"
                    type="button"
                  >
                    {"Текущий месяц"}
                  </button>
                </div>
                <p id="calendar-jump-help" className="admin-muted">
                  {
                    "Выберите месяц и год. Если нет календаря ввода, укажите ГГГГ-ММ."
                  }
                </p>
                <div className="admin-calendar-weekdays" aria-hidden="true">
                  <span>{"Пн"}</span>
                  <span>{"Вт"}</span>
                  <span>{"Ср"}</span>
                  <span>{"Чт"}</span>
                  <span>{"Пт"}</span>
                  <span>{"Сб"}</span>
                  <span>{"Вс"}</span>
                </div>
                <div
                  id="calendar-days"
                  className="admin-calendar-days"
                  role="group"
                  aria-labelledby="calendar-month"
                ></div>
                <p className="admin-calendar-legend">
                  <span
                    className="admin-calendar-dot"
                    aria-hidden="true"
                  ></span>
                  {"\n                Занято "}
                  <span>{"Остальные даты свободны"}</span>
                </p>
                <label className="admin-check">
                  <input id="calendar-multiple" type="checkbox" />
                  {"Выбрать\n                несколько дат"}
                </label>
                <div
                  id="calendar-bulk"
                  className="admin-calendar-bulk"
                  hidden={true}
                >
                  <p
                    id="calendar-selected"
                    className="admin-muted"
                    role="status"
                  >
                    {"\n                  Даты не выбраны\n                "}
                  </p>
                  <div className="admin-actions">
                    <button
                      id="calendar-mark-busy"
                      className="admin-button"
                      type="button"
                      disabled={true}
                    >
                      {
                        "\n                    Отметить занятыми\n                  "
                      }
                    </button>
                    <button
                      id="calendar-mark-free"
                      className="admin-button secondary"
                      type="button"
                      disabled={true}
                    >
                      {"\n                    Освободить\n                  "}
                    </button>
                    <button
                      id="calendar-clear"
                      className="admin-button secondary"
                      type="button"
                      disabled={true}
                    >
                      {"\n                    Снять выбор\n                  "}
                    </button>
                  </div>
                </div>
                <p className="admin-muted admin-calendar-help">
                  {
                    "\n                Нажмите на дату, чтобы изменить её статус. Для нескольких дат\n                включите режим выбора.\n                Сегодняшняя дата подчёркнута. Стрелки перемещают фокус по дням,\n                Page Up / Page Down — по месяцам, Home / End — к началу и концу месяца.\n              "
                  }
                </p>
              </div>
              <section
                className="admin-busy-dates"
                aria-labelledby="calendar-list-title"
              >
                <h2 id="calendar-list-title">{"Занятые даты"}</h2>
                <p
                  id="calendar-upcoming"
                  className="admin-muted"
                  role="status"
                ></p>
                <div className="admin-date-filters">
                  <label>
                    {"Период"}
                    <select id="calendar-period">
                      <option value="upcoming">{"Предстоящие"}</option>
                      <option value="past">{"Прошедшие"}</option>
                      <option value="all">{"Все даты"}</option>
                    </select>
                  </label>
                  <label>
                    {"Поиск по дате или заметке"}
                    <input
                      id="calendar-search"
                      type="search"
                      placeholder="Дата, имя или площадка"
                      maxLength="200"
                    />
                  </label>
                </div>
                <p
                  id="calendar-found"
                  className="admin-muted"
                  role="status"
                ></p>
                <p className="admin-muted admin-calendar-help">
                  {
                    "\n                Заметки видны только вам.\n              "
                  }
                </p>
                <div id="calendar-busy-list" className="admin-list"></div>
              </section>
            </div>
          </section>
          <section
            id="panel-gallery"
            className="admin-panel"
            role="tabpanel"
            aria-labelledby="tab-gallery"
            hidden={true}
          >
            <div className="admin-heading">
              <div>
                <p className="admin-kicker">{"Фотографии на сайте"}</p>
                <h1>{"Галерея"}</h1>
                <p className="admin-muted">
                  {
                    "\n                Загрузите снимки, выберите избранные и задайте порядок на сайте.\n              "
                  }
                </p>
              </div>
              <button
                id="gallery-refresh"
                className="admin-button secondary"
                type="button"
              >
                {"\n              Обновить\n            "}
              </button>
            </div>
            <form id="upload-form" className="admin-upload">
              <fieldset id="upload-fields">
                <legend>{"Добавить фотографию"}</legend>
                <div className="admin-upload-grid">
                  <label className="admin-field" htmlFor="photo-file">
                    {"Фотография\n                  "}
                    <input
                      id="photo-file"
                      name="photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required={true}
                      aria-describedby="upload-help"
                    />
                    <small id="upload-help">
                      {
                        "JPEG, PNG или WebP, до 20 МБ. Перед загрузкой фото\n                    автоматически уменьшается до 2048 пикселей."
                      }
                    </small>
                  </label>
                  <label className="admin-field" htmlFor="photo-alt">
                    {"Описание изображения\n                  "}
                    <input
                      id="photo-alt"
                      name="alt"
                      maxLength="240"
                      required={true}
                      placeholder="Например: гости танцуют на свадьбе"
                    />
                    <small>
                      {"Кратко опишите, что изображено на фотографии."}
                    </small>
                  </label>
                  <label className="admin-field" htmlFor="photo-caption">
                    {"Подпись на сайте\n                  "}
                    <span className="admin-optional">{"необязательно"}</span>
                    <input id="photo-caption" name="caption" maxLength="240" />
                  </label>
                </div>
                <div className="admin-upload-bottom">
                  <label className="admin-check">
                    <input
                      id="photo-published"
                      type="checkbox"
                      defaultChecked={true}
                    />
                    {"Показать на сайте после загрузки"}
                  </label>
                  <p className="admin-muted">
                    {
                      "Скрытые фото остаются в панели. Прямая ссылка на файл сохраняет доступ к изображению."
                    }
                  </p>
                  <label className="admin-check">
                    <input
                      id="photo-featured"
                      name="featured"
                      type="checkbox"
                    />
                    {"Избранное — для главной страницы"}
                  </label>
                  <img
                    id="upload-preview"
                    className="admin-upload-preview"
                    alt="Предпросмотр выбранной фотографии"
                    hidden={true}
                  />
                  <button
                    id="upload-clear"
                    className="admin-button secondary"
                    type="button"
                    hidden={true}
                  >
                    {"Убрать выбранный файл"}
                  </button>
                  <button
                    id="upload-submit"
                    className="admin-button"
                    type="submit"
                  >
                    {
                      "\n                  Загрузить фотографию\n                "
                    }
                  </button>
                </div>
              </fieldset>
            </form>
            <p
              id="gallery-message"
              className="admin-message"
              role="status"
              aria-live="polite"
            ></p>
            <div className="admin-filters">
              <label className="admin-field" htmlFor="gallery-search">
                {"Поиск фотографий\n              "}
                <input
                  id="gallery-search"
                  type="search"
                  maxLength="240"
                  placeholder="Описание или подпись"
                  autoComplete="off"
                />
              </label>
              <label className="admin-field" htmlFor="gallery-filter">
                {"Публикация\n              "}
                <select id="gallery-filter">
                  <option value="">{"Все фотографии"}</option>
                  <option value="published">{"На сайте"}</option>
                  <option value="draft">{"Скрыто с сайта"}</option>
                </select>
              </label>
            </div>
            <p id="gallery-count" className="admin-muted" role="status"></p>
            <p id="gallery-filter-empty" className="admin-empty" hidden={true}>
              {
                "Фотографии не найдены. Измените запрос или выберите все фотографии."
              }
            </p>
            <div id="gallery-list" className="admin-gallery"></div>
          </section>
        </div>
        <noscript>
          <p className="admin-message">
            Для управления сайтом включите JavaScript в настройках браузера.
          </p>
        </noscript>
      </main>
      <footer className="admin-footer">
        <span>{"Ольга Жукова · Управление сайтом"}</span>
        <a href="/" target="_blank" rel="noopener noreferrer">
          {"Перейти на сайт ↗"}
        </a>
      </footer>
    </div>
  );
}
