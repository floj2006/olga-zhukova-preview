import { pageMetadata } from "../../lib/page-metadata";
import PublicShell from "../../components/site/PublicShell";
import AvailabilityInvite from "../../components/site/AvailabilityInvite";
import FAQ from "../../components/site/FAQ";
export const metadata = pageMetadata({
  title: "Контакты",
  description:
    "Телефон Ольги Жуковой: 8 911 444-90-71. Проверьте дату, выберите услуги и отправьте заявку на мероприятие в Вологде или с выездом.",
  alternates: { canonical: "/contacts" },
});
export default function ContactsPage() {
  return (
    <PublicShell mainClassName="editorial-page contacts-page">
      <section
        className="contact-editorial"
        id="top"
        aria-labelledby="contacts-title"
      >
        <div className="container contact-editorial-grid">
          <div className="contact-editorial-copy">
            <p className="eyebrow">КОНТАКТЫ</p>
            <h1 id="contacts-title" data-editorial-entrance>
              Какой вечер
              <br />
              <em>вы задумали?</em>
            </h1>
            <p>
              Расскажите о поводе и тех, кого хотите собрать.
              <br />
              Формат и программу обсудим вместе.
            </p>
            <a className="contact-editorial-phone" href="tel:+79114449071">
              8 911 444-90-71 <span aria-hidden="true">↗</span>
            </a>
            <span className="eyebrow">
              ОЛЬГА ЖУКОВА · ВОЛОГДА И ВЫЕЗДНЫЕ СОБЫТИЯ
            </span>
            <div className="contact-editorial-actions">
              <a className="button" href="/services#calculator" data-discuss="">
                Выбрать дату и услуги <span aria-hidden="true">→</span>
              </a>
              <a className="text-link" href="/services#calculator">
                Рассчитать стоимость <span aria-hidden="true">↗</span>
              </a>
            </div>
            <small>
              Первая встреча — бесплатно. Для заявки нужны имя и телефон.
            </small>
          </div>
          <figure>
            <img
              src="/images/olga-1024.webp"
              srcSet="/images/olga-480.webp 480w, /images/olga-768.webp 768w, /images/olga-1024.webp 1024w"
              sizes="(max-width:700px) 100vw,40vw"
              alt="Ольга Жукова"
              width="1024"
              height="1536"
              fetchPriority="high"
            />
            <figcaption>НАЧНЁМ С ЗНАКОМСТВА</figcaption>
          </figure>
        </div>
      </section>
      <AvailabilityInvite />
      <FAQ />
    </PublicShell>
  );
}
