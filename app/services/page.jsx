import { pageMetadata } from "../../lib/page-metadata";
import PublicShell from "../../components/site/PublicShell";
import Calculator from "../../components/site/Calculator";
import AvailabilityInvite from "../../components/site/AvailabilityInvite";
import Process from "../../components/site/Process";
import FAQ from "../../components/site/FAQ";
import Contact from "../../components/site/Contact";
export const metadata = pageMetadata({
  title: "Услуги и стоимость",
  description:
    "Соберите стоимость: ведущая, DJ, оборудование, организация и координатор. Актуальные тарифы, проверка даты и заявка Ольге Жуковой.",
  alternates: { canonical: "/services" },
});
export default function ServicesPage() {
  return (
    <PublicShell mainClassName="editorial-page services-page">
      <section
        className="services-intro"
        id="top"
        aria-labelledby="services-title"
      >
        <div className="container">
          <p className="eyebrow">УСЛУГИ И СТОИМОСТЬ</p>
          <div className="services-intro-grid">
            <h1 id="services-title" data-editorial-entrance>
              Ваш вечер.
              <br />
              <em>С понятной стоимостью.</em>
            </h1>
            <div>
              <p>
                Ведение, музыка, техника и помощь в подготовке — выбирайте то,
                что нужно именно вам.
              </p>
              <a className="text-link" href="#calculator">
                Рассчитать стоимость <span aria-hidden="true">↓</span>
              </a>
              <p className="services-intro-note">
                Первая встреча бесплатна.
                <br />
                Заявка — без оплаты и обязательств.
              </p>
            </div>
          </div>
        </div>
      </section>
      <Calculator />
      <AvailabilityInvite />
      <section
        className="service-notes section"
        aria-labelledby="service-notes-title"
      >
        <div className="container service-notes-grid">
          <div className="reveal">
            <p className="eyebrow">КАК СКЛАДЫВАЕТСЯ СТОИМОСТЬ</p>
            <h2 id="service-notes-title">
              Выбирайте то,
              <br />
              <em>что нужно вам.</em>
            </h2>
          </div>
          <dl className="reveal">
            <div>
              <dt>Продолжительность</dt>
              <dd>
                Ведущая и DJ рассчитываются по часам. Длительность можно
                изменить под программу.
              </dd>
            </div>
            <div>
              <dt>Площадка и техника</dt>
              <dd>
                Стандартная аппаратура уже входит в стоимость DJ. Дополнительный
                звук, свет и экраны выбираются отдельно.
              </dd>
            </div>
            <div>
              <dt>Подготовка и команда</dt>
              <dd>
                Поиск подрядчиков, артистов и площадки, организация и
                координатор добавляются по вашей задаче.
              </dd>
            </div>
            <div>
              <dt>Позиции с ценой «от»</dt>
              <dd>
                Оборудование и условия уточним перед подтверждением. Итоговый
                состав согласуем лично.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <Process />
      <FAQ />
      <Contact />
    </PublicShell>
  );
}
