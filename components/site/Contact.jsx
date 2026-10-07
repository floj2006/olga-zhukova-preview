export default function Contact({ eventType }) {
  return (
    <section className="final-cta" id="contact" aria-labelledby="contact-title">
      <img
        src="/images/banquet-1536.webp"
        srcSet="/images/banquet-768.webp 768w, /images/banquet-1536.webp 1536w"
        sizes="100vw"
        className="final-image"
        alt=""
        width="1536"
        height="1025"
        loading="lazy"
        decoding="async"
      />
      <div className="final-overlay" aria-hidden="true" />
      <div className="container final-content reveal">
        <p className="eyebrow">ВАШИ ЛЮДИ. ВАШ ПОВОД. ВАШ ВЕЧЕР.</p>
        <h2 id="contact-title">
          Теперь —<br />
          <em>ваша история.</em>
        </h2>
        <p>Начнём с даты. Затем выберем услуги и обсудим, каким будет вечер.</p>
        <a
          className="button"
          href="/services#calculator"
          data-discuss=""
          {...(eventType ? { "data-event": eventType } : {})}
        >
          Узнать стоимость{" "}
          <svg className="icon" aria-hidden="true">
            <use href="#arrow" />
          </svg>
        </a>
        <a className="contact-phone" href="tel:+79114449071">
          8 911 444-90-71
        </a>
        <span className="contact-note">ОЛЬГА ЖУКОВА · ВЕДУЩАЯ МЕРОПРИЯТИЙ</span>
      </div>
    </section>
  );
}
