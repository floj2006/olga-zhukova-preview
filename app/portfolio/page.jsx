import { pageMetadata } from "../../lib/page-metadata";
import PublicShell from "../../components/site/PublicShell";
import Materials from "../../components/site/Materials";
import Gallery from "../../components/site/Gallery";
import Reviews from "../../components/site/Reviews";
import PortfolioStatus from "../../components/site/PortfolioStatus";
import Contact from "../../components/site/Contact";
export const metadata = pageMetadata({
  title: "Портфолио",
  description:
    "Портфолио Ольги Жуковой — ведущей мероприятий в Вологде и с выездом. Познакомьтесь с подходом и обсудите ваше событие.",
  alternates: { canonical: "/portfolio" },
});
export default function PortfolioPage() {
  return (
    <PublicShell mainClassName="editorial-page portfolio-page">
      <section
        className="portfolio-intro"
        id="top"
        aria-labelledby="portfolio-title"
      >
        <div className="container">
          <p className="eyebrow">ФОТОГРАФИИ · ВИДЕО · ВПЕЧАТЛЕНИЯ</p>
          <h1 id="portfolio-title" data-editorial-entrance>
            Вечер —<br />
            <em>в деталях.</em>
          </h1>
          <div className="portfolio-intro-bottom">
            <p>
              Настроение вечера складывается из людей, общения и деталей.
              Расскажите о вашем поводе — обсудим, что важно именно вам.
            </p>
            <a className="text-link" href="/events">
              Выбрать формат <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
      <div className="portfolio-materials">
        <Gallery />
        <Materials />
        <Reviews />
        <PortfolioStatus />
      </div>
      <Contact />
    </PublicShell>
  );
}
