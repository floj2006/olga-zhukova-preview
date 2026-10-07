export default function Hero() {
  return (
    <section
      className="hero editorial-hero"
      id="top"
      aria-labelledby="hero-title"
    >
      <div className="container hero-poster">
        <div className="hero-topline">
          <p className="eyebrow">ВЕДУЩАЯ МЕРОПРИЯТИЙ</p>
          <span>ВОЛОГДА · ВЫЕЗДНЫЕ СОБЫТИЯ</span>
        </div>
        <figure className="hero-portrait">
          <img
            className="hero-image"
            src="/images/olga-1024.webp"
            srcSet="/images/olga-480.webp 480w, /images/olga-768.webp 768w, /images/olga-1024.webp 1024w"
            sizes="(max-width: 700px) 65vw, (max-width: 1200px) 48vw, 560px"
            alt="Ольга Жукова, ведущая мероприятий"
            width="1024"
            height="1536"
            fetchPriority="high"
          />
          <figcaption>
            <span>15+ ЛЕТ В ПРОФЕССИИ</span>
            <span>С ВНИМАНИЕМ К ЛЮДЯМ</span>
          </figcaption>
        </figure>
        <div className="hero-content">
          <h1 id="hero-title" data-editorial-entrance>
            <span>Ольга</span>
            <em>Жукова</em>
          </h1>
          <div className="hero-byline">
            <p>
              Ваши люди.
              <br />
              <span>Ваш повод быть вместе.</span>
            </p>
            <span className="hero-description">
              Свадьбы, корпоративы, юбилеи и выпускные.
              <br />
              Программа, в которой гости чувствуют себя своими.
            </span>
          </div>
          <div className="hero-actions">
            <a className="button" href="/services#calculator" data-discuss="">
              Узнать стоимость{" "}
              <svg className="icon" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </a>
            <a className="text-link" href="/events">
              Посмотреть мероприятия <span aria-hidden="true">↗</span>
            </a>
            <a
              className="hero-calendar-link"
              href="/services#calculator"
              data-check-date=""
            >
              Проверить дату <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#events" className="scroll-cue">
            <span className="scroll-line" />
            ВЫБЕРИТЕ ВАШ ПОВОД
          </a>
          <div className="hero-trust">
            <span>Первая встреча — бесплатно</span>
            <span>Ведение · DJ · координация</span>
          </div>
          <span className="hero-edition" aria-hidden="true">
            01 / ВАШ ВЕЧЕР
          </span>
        </div>
      </div>
    </section>
  );
}
