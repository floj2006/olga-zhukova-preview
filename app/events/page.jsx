import { pageMetadata } from "../../lib/page-metadata";
import PublicShell from "../../components/site/PublicShell";
import Formats from "../../components/site/Formats";
import Contact from "../../components/site/Contact";

export const metadata = pageMetadata({
  title: "Форматы мероприятий в Вологде",
  description:
    "Свадьбы, корпоративы, юбилеи и выпускные с Ольгой Жуковой. Выберите формат, познакомьтесь с программой и рассчитайте услуги для своего события.",
  alternates: { canonical: "/events" },
});

export default function EventsPage() {
  return (
    <PublicShell mainClassName="editorial-page events-overview">
      <section
        className="events-index-intro"
        id="top"
        aria-labelledby="events-index-title"
      >
        <div className="container">
          <p className="eyebrow">
            <span className="short-line" aria-hidden="true" />
            МЕРОПРИЯТИЯ
          </p>
          <div className="events-index-intro-grid">
            <h1 id="events-index-title">
              Ваш повод.
              <br />
              <em>Ваш формат.</em>
            </h1>
            <div>
              <p>
                Свадьба, корпоратив, юбилей или выпускной. Выберите свой повод и
                посмотрите, как мы подготовим вечер для ваших гостей.
              </p>
              <a className="text-link" href="#events">
                Выбрать формат <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </div>
      </section>
      <Formats overview />
      <Contact />
    </PublicShell>
  );
}
