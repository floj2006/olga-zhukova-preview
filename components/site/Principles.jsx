export default function Principles() {
  return (
    <section
      className="principles section"
      id="principles"
      aria-labelledby="principles-title"
    >
      <div className="container principles-grid">
        <div className="principles-intro reveal">
          <p className="eyebrow">
            <span className="short-line"></span>
            {"КАК Я ВЕДУ ВАШ ПРАЗДНИК\n            "}
          </p>
          <h2 id="principles-title">
            {"\n              Пять принципов."}
            <br />
            {"Один "}
            <em>{"ваш вечер."}</em>
          </h2>
          <p className="body-copy">
            {"\n              Важен весь вечер."}
            <br />
            {"И то, как в нём чувствует себя каждый.\n            "}
          </p>
        </div>
        <div className="reason-list">
          <article className="reason reveal">
            <span className="reason-number">{"01"}</span>
            <div>
              <h3>{"ОПЫТ И СПОКОЙСТВИЕ"}</h3>
              <p>
                {
                  "\n                  15+ лет веду мероприятия. Этот опыт помогает держать ритм\n                  программы и спокойно реагировать, когда планы меняются.\n                "
                }
              </p>
            </div>
          </article>
          <article className="reason reveal">
            <span className="reason-number">{"02"}</span>
            <div>
              <h3>{"ЖИВОЙ РИТМ"}</h3>
              <p>
                {
                  "\n                  Чередую общение, музыку и важные слова. Чувствую, когда зал\n                  готов к танцам, а когда хочется задержаться в разговоре.\n                "
                }
              </p>
            </div>
          </article>
          <article className="reason reveal">
            <span className="reason-number">{"03"}</span>
            <div>
              <h3>{"ВАША ИСТОРИЯ"}</h3>
              <p>
                {
                  "\n                  Знакомлюсь с вашими пожеланиями и историями. Они становятся\n                  основой программы и помогают гостям узнать в ней себя.\n                "
                }
              </p>
            </div>
          </article>
          <article className="reason reveal">
            <span className="reason-number">{"04"}</span>
            <div>
              <h3>{"СВОБОДА УЧАСТВОВАТЬ"}</h3>
              <p>
                {
                  "\n                  Приглашаю к участию и уважаю выбор гостей. Кто-то любит быть в\n                  центре внимания, кому-то приятнее наблюдать.\n                "
                }
              </p>
            </div>
          </article>
          <article className="reason reveal">
            <span className="reason-number">{"05"}</span>
            <div>
              <h3>{"ВНИМАНИЕ К ДЕТАЛЯМ"}</h3>
              <p>
                {
                  "\n                  Уточняю имена, согласовываю музыкальные акценты и время подачи\n                  блюд. Эти детали помогают вечеру идти в общем ритме.\n                "
                }
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
