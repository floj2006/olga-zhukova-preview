import { pageMetadata } from "../lib/page-metadata";
import Materials from "../components/site/Materials";
import Reviews from "../components/site/Reviews";
import Hero from "../components/site/Hero";
import About from "../components/site/About";
import Formats from "../components/site/Formats";
import Gallery from "../components/site/Gallery";
import Principles from "../components/site/Principles";
import Process from "../components/site/Process";
import Calculator from "../components/site/Calculator";
import AvailabilityInvite from "../components/site/AvailabilityInvite";
import Contact from "../components/site/Contact";
import FAQ from "../components/site/FAQ";
import PublicShell from "../components/site/PublicShell";
export const metadata = pageMetadata({
  title: { absolute: "Ольга Жукова — ведущая мероприятий в Вологде" },
  description:
    "Свадьбы, корпоративы, юбилеи и выпускные с Ольгой Жуковой. 15+ лет опыта. Проверьте дату и соберите стоимость по актуальным услугам.",
  alternates: { canonical: "/" },
});
export default function Home() {
  return (
    <PublicShell home>
      <Hero />
      <section
        className="editorial-statement section"
        aria-labelledby="statement-title"
      >
        <div className="container statement-grid">
          <p className="eyebrow">ВАЖНОЕ — МЕЖДУ ЛЮДЬМИ</p>
          <div className="reveal">
            <h2 id="statement-title">
              Чтобы быть
              <br />
              <em>внутри праздника.</em>
            </h2>
            <p>
              Обнимать близких. Смеяться с друзьями. Слышать важные слова. Я
              беру на себя программу и ритм вечера — вы проводите его с теми,
              кого пригласили.
            </p>
          </div>
          <a className="text-link" href="/about">
            Познакомиться с Ольгой <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
      <Formats />
      <About />
      <Materials />
      <Gallery />
      <Principles />
      <Process />
      <Calculator />
      <AvailabilityInvite />
      <Reviews />
      <FAQ />
      <Contact />
    </PublicShell>
  );
}
