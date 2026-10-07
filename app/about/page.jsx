import { pageMetadata } from "../../lib/page-metadata";
import PublicShell from "../../components/site/PublicShell";
import PageHero from "../../components/site/PageHero";
import Process from "../../components/site/Process";
import Contact from "../../components/site/Contact";
export const metadata = pageMetadata({
  title: "О ведущей",
  description:
    "Ольга Жукова: 15+ лет ведения мероприятий, внимание к гостям и подготовка программы. Вологда и выездные события.",
  alternates: { canonical: "/about" },
});
export default function AboutPage() {
  return (
    <PublicShell mainClassName="editorial-page about-page">
      <PageHero
        eyebrow="О ВЕДУЩЕЙ"
        title="Я Ольга."
        accent="Давайте знакомиться."
        description="Веду свадьбы, корпоративы, юбилеи и выпускные. Помогаю разным людям почувствовать себя частью одного вечера."
        image="/images/olga-1024.webp"
        imageAlt="Ольга Жукова в белом костюме"
        number="15+ ЛЕТ"
        secondaryHref="#approach"
        secondaryLabel="Мой подход"
        note="Вологда и выездные мероприятия."
        variant="profile"
      />
      <section
        className="profile-statement section"
        id="approach"
        aria-labelledby="profile-title"
      >
        <div className="container profile-grid">
          <div className="profile-experience reveal">
            <span>15+</span>
            <p>ЛЕТ В ПРОФЕССИИ</p>
            <small>
              Опыт помогает чувствовать зал
              <br />и спокойно менять темп.
            </small>
          </div>
          <div className="reveal">
            <p className="eyebrow">СНАЧАЛА — ЛЮДИ</p>
            <h2 id="profile-title">
              У программы
              <br />
              <em>должен быть ваш характер.</em>
            </h2>
            <p className="profile-copy">
              На первой встрече я спрашиваю о гостях, ваших историях и том, чего
              вам точно не хочется. Так появляется вечер, в котором есть место
              именно вашим отношениям и привычкам.
            </p>
            <p className="profile-copy">
              В день события слежу за ритмом, нахожу слова для важных моментов и
              остаюсь на связи с DJ и площадкой. Если планы меняются, программа
              меняется вместе с ними.
            </p>
          </div>
        </div>
      </section>
      <section
        className="profile-principles section"
        aria-labelledby="profile-principles-title"
      >
        <div className="container">
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">ЧТО ВАЖНО В МОЕЙ РАБОТЕ</p>
              <h2 id="profile-principles-title">
                Внимание.
                <br />
                <em>И чувство меры.</em>
              </h2>
            </div>
            <p className="section-aside">
              Хорошая подготовка даёт свободу в моменте — вам, вашим гостям и
              самому вечеру.
            </p>
          </div>
          <div className="profile-principle-list">
            {[
              [
                "01",
                "Участие по желанию",
                "Приглашаю гостей к общению и уважаю их выбор. Быть зрителем — тоже быть частью праздника.",
              ],
              [
                "02",
                "Время для общения",
                "Между важными словами и музыкой остаётся время на разговоры, еду и неожиданные моменты.",
              ],
              [
                "03",
                "Подготовка заранее",
                "Имена, музыка, подача блюд, выступления и паузы согласуем заранее, чтобы в день события вы могли отдыхать.",
              ],
            ].map(([index, title, text]) => (
              <article key={index} className="reveal">
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Process />
      <Contact />
    </PublicShell>
  );
}
