import FormatTabs from "./FormatTabs";
function OverviewFormats({ children }) {
  return <div className="event-overview-grid">{children}</div>;
}
export default function Formats({ overview = false }) {
  const FormatLayout = overview ? OverviewFormats : FormatTabs;
  return (
    <section
      className="events section"
      id="events"
      aria-labelledby={overview ? undefined : "events-title"}
      aria-label={overview ? "Форматы мероприятий" : undefined}
    >
      <div className="container">
        {!overview ? (
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">
                <span className="short-line"></span>
                {"ПОВОД БЫТЬ ВМЕСТЕ\n              "}
              </p>
              <h2 id="events-title">
                {"Ваш повод."}
                <br />
                <em>{"Ваш характер."}</em>
              </h2>
            </div>
            <p className="section-aside">
              {"\n              Близкие за одним столом или целая команда."}
              <br />
              {
                "Программа\n              начинается с тех, кого вы приглашаете.\n            "
              }
            </p>
          </div>
        ) : null}
        <FormatLayout labels={["Свадьба", "Корпоратив", "Юбилей", "Выпускной"]}>
          <article className="event-card visible" data-event="wedding">
            <div className="event-image">
              <img
                src="/images/wedding-moment.jpg"
                alt="Молодожёны в тёплом вечернем свете"
                width="1000"
                height="667"
                loading="lazy"
                decoding="async"
              />
              <span className="event-number">{"01"}</span>
              <span className="event-image-label">{"ВАША ИСТОРИЯ ВДВОЁМ"}</span>
            </div>
            <div className="event-copy">
              <p className="format-audience">
                {"ДЛЯ ВАС ДВОИХ И САМЫХ БЛИЗКИХ"}
              </p>
              <h3>
                {"Свадьба "}
                <em>{"с вашим характером."}</em>
              </h3>
              <p className="format-description">
                {
                  "\n                  Праздник, в котором узнаются ваши истории, ваши люди и ваш\n                  ритм. Чтобы прожить этот вечер вместе.\n                "
                }
              </p>
              <ul className="format-includes" aria-label="В программе свадьбы">
                <li>{"Знакомство и ваши истории"}</li>
                <li>{"Важные слова и живое общение"}</li>
                <li>{"Ритм вечера и внимание к гостям"}</li>
              </ul>
              <div className="format-actions">
                <a className="format-cta" href="/events/wedding">
                  <span>Подробнее о свадьбе</span>
                  <svg className="icon" aria-hidden="true">
                    <use href="#arrow-up" />
                  </svg>
                </a>
                <a
                  className="format-calc-link"
                  data-discuss=""
                  data-event="wedding"
                  href={overview ? "/services#calculator" : "#calculator"}
                >
                  Рассчитать
                </a>
              </div>
            </div>
          </article>
          <article className="event-card visible" data-event="corporate">
            <div className="event-image">
              <img
                src="/images/evening-1536.webp"
                srcSet="/images/evening-768.webp 768w, /images/evening-1536.webp 1536w"
                sizes="(max-width: 700px) 100vw, 50vw"
                alt="Элегантный зал для корпоративного вечера"
                width="1536"
                height="993"
                loading="lazy"
                decoding="async"
              />
              <span className="event-number">{"02"}</span>
              <span className="event-image-label">
                {"КОМАНДА В ДРУГОМ РИТМЕ"}
              </span>
            </div>
            <div className="event-copy">
              <p className="format-audience">
                {
                  "\n                  ДЛЯ КОЛЛЕГ, КОТОРЫМ ЕСТЬ ЧТО ОТМЕТИТЬ\n                "
                }
              </p>
              <h3>
                {"Корпоратив "}
                <em>{"по-настоящему живой."}</em>
              </h3>
              <p className="format-description">
                {
                  "\n                  Повод узнать коллег ближе. Разговоры, общие истории и танцы —\n                  с уважением к настроению каждого.\n                "
                }
              </p>
              <ul
                className="format-includes"
                aria-label="В программе корпоратива"
              >
                <li>{"Программа под вашу команду"}</li>
                <li>{"Общение и добровольное участие"}</li>
                <li>{"Тайминг и связь с площадкой"}</li>
              </ul>
              <div className="format-actions">
                <a className="format-cta" href="/events/corporate">
                  <span>Подробнее о корпоративе</span>
                  <svg className="icon" aria-hidden="true">
                    <use href="#arrow-up" />
                  </svg>
                </a>
                <a
                  className="format-calc-link"
                  data-discuss=""
                  data-event="corporate"
                  href={overview ? "/services#calculator" : "#calculator"}
                >
                  Рассчитать
                </a>
              </div>
            </div>
          </article>
          <article className="event-card visible" data-event="anniversary">
            <div className="event-image">
              <img
                src="/images/celebration.jpg"
                alt="Друзья поднимают бокалы за праздничным столом"
                width="1000"
                height="667"
                loading="lazy"
                decoding="async"
              />
              <span className="event-number">{"03"}</span>
              <span className="event-image-label">
                {"САМОЕ ВАЖНОЕ — РЯДОМ"}
              </span>
            </div>
            <div className="event-copy">
              <p className="format-audience">
                {
                  "\n                  ДЛЯ СЕМЬИ, ДРУЗЕЙ И РАЗНЫХ ПОКОЛЕНИЙ\n                "
                }
              </p>
              <h3>
                {"Юбилей "}
                <em>{"в кругу своих."}</em>
              </h3>
              <p className="format-description">
                {
                  "\n                  Дорогие люди, любимые истории и слова, которые давно хотелось\n                  сказать. Тёплый вечер в честь главного героя.\n                "
                }
              </p>
              <ul className="format-includes" aria-label="В программе юбилея">
                <li>{"Личные истории и поздравления"}</li>
                <li>{"Внимание к разным поколениям"}</li>
                <li>{"Общение в комфортном ритме"}</li>
              </ul>
              <div className="format-actions">
                <a className="format-cta" href="/events/anniversary">
                  <span>Подробнее о юбилее</span>
                  <svg className="icon" aria-hidden="true">
                    <use href="#arrow-up" />
                  </svg>
                </a>
                <a
                  className="format-calc-link"
                  data-discuss=""
                  data-event="anniversary"
                  href={overview ? "/services#calculator" : "#calculator"}
                >
                  Рассчитать
                </a>
              </div>
            </div>
          </article>
          <article className="event-card visible" data-event="graduation">
            <div className="event-image">
              <img
                src="/images/wedding.jpg"
                alt="Праздничная сервировка с цветами для торжественного вечера"
                width="1000"
                height="667"
                loading="lazy"
                decoding="async"
              />
              <span className="event-number">{"04"}</span>
              <span className="event-image-label">
                {"НА ПОРОГЕ НОВОЙ ГЛАВЫ"}
              </span>
            </div>
            <div className="event-copy">
              <p className="format-audience">
                {"ДЛЯ ВЫПУСКНИКОВ И ИХ БЛИЗКИХ"}
              </p>
              <h3>
                {"Выпускной "}
                <em>{"с продолжением."}</em>
              </h3>
              <p className="format-description">
                {
                  "\n                  Вспомнить общее, поблагодарить друг друга и почувствовать\n                  начало нового. Сценарий под ваших гостей и ваш повод.\n                "
                }
              </p>
              <ul
                className="format-includes"
                aria-label="В программе выпускного"
              >
                <li>{"Общие истории и важные слова"}</li>
                <li>{"Программа с учётом пожеланий"}</li>
                <li>{"Место для общения и танцев"}</li>
              </ul>
              <div className="format-actions">
                <a className="format-cta" href="/events/graduation">
                  <span>Подробнее о выпускном</span>
                  <svg className="icon" aria-hidden="true">
                    <use href="#arrow-up" />
                  </svg>
                </a>
                <a
                  className="format-calc-link"
                  data-discuss=""
                  data-event="graduation"
                  href={overview ? "/services#calculator" : "#calculator"}
                >
                  Рассчитать
                </a>
              </div>
            </div>
          </article>
        </FormatLayout>
        <p className="photo-note">
          {
            "\n            У каждого повода — свои гости, истории и ритм.\n          "
          }
        </p>
      </div>
    </section>
  );
}
