export default function NotFound() {
  return (
    <div className="public-site">
      <main className="container not-found-editorial" id="main">
        <p className="eyebrow">ОЛЬГА ЖУКОВА · 404</p>
        <h1>
          Этой страницы
          <br />
          <em>здесь нет.</em>
        </h1>
        <p>Вернитесь на главную или выберите формат вашего события.</p>
        <a className="button" href="/">
          На главную <span aria-hidden="true">→</span>
        </a>
        <a className="text-link" href="/events">
          Мероприятия <span aria-hidden="true">↗</span>
        </a>
      </main>
    </div>
  );
}
