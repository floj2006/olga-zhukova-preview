export default function Process() {
  return (
    <section
      className="program section"
      id="program"
      aria-labelledby="program-title"
    >
      <div className="container program-grid">
        <div className="reveal">
          <p className="eyebrow">
            <span className="short-line"></span>
            {"ОТ ПЕРВОГО РАЗГОВОРА ДО ПРАЗДНИКА\n            "}
          </p>
          <h2 id="program-title">
            {"\n              Сначала познакомимся."}
            <br />
            {"Затем "}
            <em>{"создадим программу."}</em>
          </h2>
          <p className="body-copy">
            {"\n              Обсудим главное, продумаем детали"}
            <br />
            {"и соберём их в цельный\n              вечер.\n            "}
          </p>
          <a className="text-link" href="/services#calculator">
            {"ВЫБРАТЬ УСЛУГИ"}
            <svg className="icon">
              <use href="#arrow-up" />
            </svg>
          </a>
        </div>
        <div className="program-steps reveal">
          <details name="program-step" open={true}>
            <summary>
              <span className="program-number">{"01"}</span>
              <span>{"Знакомимся"}</span>
              <span className="details-sign" aria-hidden="true"></span>
            </summary>
            <div className="details-copy">
              <p>
                {
                  "\n                  Начнём с даты, площадки и гостей. Расскажите, какое настроение\n                  вам близко и что обязательно должно быть в программе.\n                "
                }
              </p>
              <span className="detail-label">
                {"ЗНАКОМИМСЯ С ВАМИ И ВАШИМИ ПЛАНАМИ"}
              </span>
            </div>
          </details>
          <details name="program-step">
            <summary>
              <span className="program-number">{"02"}</span>
              <span>{"Создаём программу"}</span>
              <span className="details-sign" aria-hidden="true"></span>
            </summary>
            <div className="details-copy">
              <p>
                {
                  "\n                  Соберём истории, выберем музыку и распределим события по\n                  времени. Согласуем ключевые моменты и оставим пространство для\n                  живого общения.\n                "
                }
              </p>
              <span className="detail-label">
                {"СОГЛАСУЕМ ПРОГРАММУ И РИТМ"}
              </span>
            </div>
          </details>
          <details name="program-step">
            <summary>
              <span className="program-number">{"03"}</span>
              <span>{"Встречаем гостей"}</span>
              <span className="details-sign" aria-hidden="true"></span>
            </summary>
            <div className="details-copy">
              <p>
                {
                  "\n                  Я веду программу, общаюсь с гостями и остаюсь на связи с\n                  командой площадки. Вы проводите время с теми, ради кого всё\n                  задумали.\n                "
                }
              </p>
              <span className="detail-label">
                {"ВЫ — С БЛИЗКИМИ. Я — РЯДОМ."}
              </span>
            </div>
          </details>
          <div className="venue-note">
            <span>{"Ресторанам и банкетным площадкам"}</span>
            <a href="tel:+79114449071">
              {
                "Обсудить сборные корпоративы и сотрудничество\n                "
              }
              <span aria-hidden="true">{"↗"}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
