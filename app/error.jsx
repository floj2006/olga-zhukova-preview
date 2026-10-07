"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="container section">
      <h1>Не удалось открыть страницу</h1>
      <p className="body-copy">
        Попробуйте ещё раз или позвоните Ольге:{" "}
        <a href="tel:+79114449071">8 911 444-90-71</a>.
      </p>
      <button className="button" onClick={reset}>
        Попробовать снова
      </button>
    </main>
  );
}
