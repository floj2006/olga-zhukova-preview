export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <p className="eyebrow">ВАШИ ЛЮДИ. ВАШ ПОВОД.</p>
          <a className="text-link" href="/services#calculator" data-discuss="">
            Начнём с вашей даты <span aria-hidden="true">↗</span>
          </a>
        </div>
        <a
          className="footer-name"
          href="/"
          aria-label="Ольга Жукова — на главную"
        >
          Ольга <em>Жукова</em>
        </a>
        <div className="footer-main">
          <p>
            Ведущая мероприятий
            <br />
            15+ лет в профессии
            <br />
            Вологда и выездные события
          </p>
          <nav aria-label="Навигация в подвале">
            <a href="/events">Мероприятия</a>
            <a href="/portfolio">Портфолио</a>
            <a href="/about">Обо мне</a>
            <a href="/services">Услуги и цены</a>
            <a href="/contacts">Контакты</a>
          </nav>
          <a className="footer-phone" href="tel:+79114449071">
            8 911 444-90-71 <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © <span id="year">{new Date().getFullYear()}</span> Ольга Жукова
          </span>
          <a href="/privacy">Конфиденциальность</a>
          <a href="#top">Наверх ↑</a>
        </div>
      </div>
    </footer>
  );
}
