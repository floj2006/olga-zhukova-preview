"use client";
import { useBooking } from "../booking/BookingProvider";
export default function PortfolioStatus() {
  const b = useBooking();
  const hasMaterials =
    b.catalog?.gallery?.some((photo) => photo.published !== false) ||
    b.catalog?.content?.videoUrl ||
    b.catalog?.content?.reviews?.some((review) => review.published !== false);
  if (hasMaterials) return null;
  if (b.loading)
    return (
      <section
        className="portfolio-loading section"
        aria-busy="true"
        aria-label="Загрузка фотографий"
      >
        <div className="container">
          <p className="portfolio-loading-label" role="status">
            Загружаем фотографии…
          </p>
          <div className="portfolio-loading-grid" aria-hidden="true">
            <div />
            <div />
          </div>
        </div>
      </section>
    );
  return (
    <section
      className="portfolio-empty section"
      aria-labelledby="portfolio-empty-title"
    >
      <div className="container">
        <p className="eyebrow">ФОТОГРАФИИ И ВИДЕО</p>
        <h2 id="portfolio-empty-title">
          Начнём
          <br />
          <em>с вашего повода.</em>
        </h2>
        <p role="status">
          {b.error
            ? "Не удалось загрузить фото и видео. Попробуйте ещё раз."
            : "Хотите увидеть, как может сложиться ваш вечер? Свяжитесь с Ольгой: 8 911 444-90-71. Обсудим программу, гостей и ваши пожелания."}
        </p>
        {b.error ? (
          <button type="button" className="button" onClick={b.retry}>
            Повторить загрузку
          </button>
        ) : (
          <a className="text-link" href="/events">
            Выбрать формат <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </section>
  );
}
