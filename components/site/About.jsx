export default function About() {
  return (
    <section className="about section" id="about" aria-labelledby="about-title">
      <div className="container about-grid">
        <div className="about-portrait reveal">
          <div className="portrait-frame" data-depth="">
            <img
              src="/images/olga-1024.webp"
              srcSet="/images/olga-480.webp 480w, /images/olga-768.webp 768w, /images/olga-1024.webp 1024w"
              sizes="(max-width: 600px) calc(100vw - 44px), (max-width: 900px) 80vw, 40vw"
              decoding="async"
              alt="Ольга Жукова в белом костюме"
              width="1024"
              height="1536"
              loading="lazy"
            />
          </div>
          <span className="portrait-caption">
            {"БЫТЬ РЯДОМ. ЧУВСТВОВАТЬ МОМЕНТ."}
          </span>
          <svg className="portrait-mark icon" aria-hidden="true">
            <use href="#ornament" />
          </svg>
        </div>
        <div className="about-content reveal">
          <p className="eyebrow">
            <span className="short-line"></span>
            {"ДАВАЙТЕ ЗНАКОМИТЬСЯ\n            "}
          </p>
          <h2 id="about-title">
            {"\n              Внимание к людям."}
            <br />
            <em>{"Чувство момента."}</em>
          </h2>
          <p className="body-copy">
            {
              "\n              Я Ольга Жукова. Начинаю подготовку с разговора о вас: кого вы\n              хотите собрать и каким представляете свой праздник.\n            "
            }
          </p>
          <p className="body-copy">
            {
              "\n              Чувствую настроение гостей, нахожу слова для важных моментов и\n              поддерживаю живое общение. Вы можете обнимать близких, смеяться и\n              быть частью праздника.\n            "
            }
          </p>
          <div className="experience">
            <span className="experience-number metallic">
              {"15"}
              <span>{"+"}</span>
            </span>
            <div>
              <span className="eyebrow">{"ЛЕТ В ПРОФЕССИИ"}</span>
              <p>
                {"За плечами — опыт."}
                <br />
                {"Передо мной — ваша история."}
              </p>
            </div>
          </div>
          <div className="about-signoff">
            <span className="signature">{"С теплом, Ольга"}</span>
            <a className="text-link" href="/about#approach">
              {"МОЙ ПОДХОД"}
              <svg className="icon">
                <use href="#arrow-up" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
